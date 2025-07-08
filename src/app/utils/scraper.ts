/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio";
import { Logger } from "./logger";
import { Redis } from "@upstash/redis";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const logger = new Logger("scraper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CACHE_TTL = 7 * (24 * 60 * 60);
const MAX_CACHE_SIZE = 1024000;
const REQUEST_TIMEOUT = 15000; // 15 seconds for session-based scraping
const MAX_REDIRECTS = 10;

export const urlPattern =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
}

// Create axios instance with session support and cookie jar
const createAxiosInstance = () => {
  const instance = axios.create({
    timeout: REQUEST_TIMEOUT,
    maxRedirects: MAX_REDIRECTS,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    },
    validateStatus: function (status) {
      return status < 500;
    },
    withCredentials: true
  });

  return instance;
};

function getErrorMessage(error: any): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 400:
          return "Bad Request - The server couldn't understand the request";
        case 401:
          return "Unauthorized - Authentication required";
        case 403:
          return "Forbidden - Access denied";
        case 404:
          return "Not Found - The page doesn't exist";
        case 429:
          return "Too Many Requests - Rate limited";
        case 500:
          return "Internal Server Error - Server issue";
        case 502:
          return "Bad Gateway - Server communication error";
        case 503:
          return "Service Unavailable - Server temporarily unavailable";
        default:
          return `HTTP ${status} - ${error.response.statusText || 'Unknown error'}`;
      }
    } else if (error.request) {
      return "Network Error - Unable to reach the server";
    } else if (error.code === 'ECONNABORTED') {
      return "Request Timeout - The request took too long";
    } else if (error.code === 'ENOTFOUND') {
      return "DNS Error - Domain not found";
    } else if (error.code === 'ECONNREFUSED') {
      return "Connection Refused - Server rejected the connection";
    }
  }
  return error.message || "Unknown error occurred";
}

// Special handling for Modern Campus and other CMS platforms
async function handleModernCampusFlow(url: string, axiosInstance: any) {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  
  // Handle Modern Campus portals (common patterns)
  if (domain.includes('edu') && url.includes('portal')) {
    logger.info(`Detected Modern Campus portal URL, following exact browser flow`);
    
    try {
      const portalBase = `${urlObj.protocol}//${urlObj.hostname}/portal`;
      
      // Step 1: GET logon.do?method=load to establish session and get token
      logger.info(`Step 1: Getting login form and session token`);
      axiosInstance.defaults.headers['Referer'] = `${urlObj.protocol}//${urlObj.hostname}/publicViewHome.do?method=load`;
      
      const loginFormResponse = await axiosInstance.get(`${portalBase}/logon.do?method=load`);
      
      if (loginFormResponse.status >= 400) {
        throw new Error(`Failed to load login form: HTTP ${loginFormResponse.status}`);
      }
      
      // Extract the Struts token from the form
      const loginFormPage = cheerio.load(loginFormResponse.data || '');
      const strutsToken = loginFormPage('input[name="org.apache.struts.taglib.html.TOKEN"]').attr('value');
      
      if (!strutsToken) {
        throw new Error('Could not find Struts token in login form');
      }
      
      logger.info(`Extracted Struts token: ${strutsToken.substring(0, 20)}...`);
      
      // Step 2: For forgot password URLs, we need to simulate the form submission
      if (url.includes('ForgotPassword') || url.includes('forgotPassword') || url.includes('forgotUserName')) {
        logger.info(`Step 2: Handling forgot password/username flow`);
        
        // Update headers for form submission
        axiosInstance.defaults.headers['Referer'] = `${portalBase}/logon.do?method=load`;
        axiosInstance.defaults.headers['Origin'] = `${urlObj.protocol}//${urlObj.hostname}`;
        axiosInstance.defaults.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        
        // First, POST to logon.do to simulate the "Forgot Student Number" action
        logger.info(`Submitting forgot student number form`);
        const forgotStudentForm = new URLSearchParams();
        forgotStudentForm.append('org.apache.struts.taglib.html.TOKEN', strutsToken);
        forgotStudentForm.append('method', 'forgotStudentNumber');
        forgotStudentForm.append('displayPage', 'null');
        forgotStudentForm.append('fromPage', '');
        forgotStudentForm.append('loginAsTemp', 'false');
        forgotStudentForm.append('studentStatus', 'currentStudent');
        forgotStudentForm.append('studentNumber', '');
        forgotStudentForm.append('externalAuthenticationOnly', 'false');
        forgotStudentForm.append('studentPassword', '');
        
        const forgotStudentResponse = await axiosInstance.post(`${portalBase}/logon.do`, forgotStudentForm);
        
        if (forgotStudentResponse.status >= 400) {
          logger.warn(`Forgot student number step failed: HTTP ${forgotStudentResponse.status}`);
        } else {
          logger.info(`Forgot student number form submitted successfully`);
        }
        
        // Now we can access the forgot username/password form
        // Update referer for the final request
        axiosInstance.defaults.headers['Referer'] = `${portalBase}/logon.do`;
        
        // For display purposes, we want to GET the form page, not submit it
        if (url.includes('forgotUserName') || url.includes('ForgotPassword') || url.includes('forgotPassword')) {
          logger.info(`Getting forgot username/password form page`);
          
          // The .do endpoints are form processors, but we can try to get them to show the form
          // by using a GET request or a POST with method=load/showForm
          
          try {
            // First try: GET request (some endpoints support this to show the form)
            logger.info(`Trying GET request for form display`);
            const getResponse = await axiosInstance.get(url);
            
            if (getResponse.status < 400) {
              logger.info(`GET request successful for ${url}`);
              return getResponse;
            }
            
          } catch (getError) {
            logger.warn(`GET request failed: ${getErrorMessage(getError)}`);
          }
          
          try {
            // Second try: POST with method=load to request form display
            logger.info(`Trying POST with method=load to display form`);
            const loadForm = new URLSearchParams();
            loadForm.append('org.apache.struts.taglib.html.TOKEN', strutsToken);
            loadForm.append('method', 'load');
            
            const loadResponse = await axiosInstance.post(url, loadForm);
            
            if (loadResponse.status < 400) {
              logger.info(`POST with method=load successful`);
              return loadResponse;
            }
            
          } catch (loadError) {
            logger.warn(`POST with method=load failed: ${getErrorMessage(loadError)}`);
          }
          
          try {
            // Third try: Access the login page again but look for forgot password links/forms
            logger.info(`Looking for forgot password form in login page`);
            const loginPageResponse = await axiosInstance.get(`${portalBase}/logon.do?method=load`);
            
            if (loginPageResponse.status < 400) {
              const loginPage = cheerio.load(loginPageResponse.data || '');
              
              // Check if the login page contains forgot password functionality
              const pageText = loginPage.text().toLowerCase();
              if (pageText.includes('forgot') && (pageText.includes('password') || pageText.includes('username') || pageText.includes('student number'))) {
                logger.info(`Found forgot password functionality in login page`);
                return loginPageResponse;
              }
            }
            
          } catch (loginError) {
            logger.warn(`Could not access login page: ${getErrorMessage(loginError)}`);
          }
          
          try {
            // Fourth try: POST with minimal form data to see what the endpoint expects
            logger.info(`Trying POST with minimal form data to understand requirements`);
            const minimalForm = new URLSearchParams();
            minimalForm.append('org.apache.struts.taglib.html.TOKEN', strutsToken);
            minimalForm.append('csrfToken', '');
            minimalForm.append('method', 'showForm');
            minimalForm.append('from', 'portal');
            
            const minimalResponse = await axiosInstance.post(url, minimalForm);
            return minimalResponse;
            
          } catch (minimalError) {
            logger.error(`All form access methods failed: ${getErrorMessage(minimalError)}`);
            
            // As a last resort, return an informative error with the login page
            try {
              const loginFallback = await axiosInstance.get(`${portalBase}/logon.do?method=load`);
              
              // Add helpful context to the response
              const loginPage = cheerio.load(loginFallback.data || '');
              const combinedContent = loginPage.text() + `

--- SCRAPER NOTE ---
The forgot username/password functionality at ${url} requires form submission with specific data including:
- Email address
- reCAPTCHA verification
- Proper session tokens

This endpoint (${url}) is a form processor that expects POST data. The actual forgot password form is likely embedded in the login page above.
`;
              
              // Modify the response to include our note
              const modifiedResponse = {
                ...loginFallback,
                data: loginFallback.data + `<!-- ${combinedContent} -->`
              };
              
              return modifiedResponse;
              
            } catch (fallbackError) {
              throw minimalError; // Throw the original error if fallback fails
            }
          }
        }
      }
      
      // Step 3: For other URLs, try direct access with session
      logger.info(`Step 3: Accessing target URL with established session: ${url}`);
      const targetResponse = await axiosInstance.get(url);
      return targetResponse;
      
    } catch (error) {
      logger.error(`Modern Campus flow failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }
  
  // For other domains, try direct access
  return await axiosInstance.get(url);
}

export async function scrapeUrl(url: string) {
  try {
    logger.info(`Starting scrape process for: ${url}`);
    
    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      logger.error(`Invalid URL format: ${url}`);
      return {
        url,
        title: "",
        headings: { h1: "", h2: "" },
        metaDescription: "",
        content: "",
        error: "Invalid URL format",
      };
    }

    const cached = await getCachedContent(url);
    if (cached) {
      logger.info(`Using cached content for: ${url}`);
      return cached;
    }
    
    logger.info(`Cache miss - proceeding with fresh scrape for: ${url}`);

    // Create a fresh axios instance for each scrape to avoid session conflicts
    const axiosInstance = createAxiosInstance();
    
    // Handle session-based scraping if needed
    let response;
    try {
      response = await handleModernCampusFlow(url, axiosInstance);
    } catch (sessionError) {
      logger.warn(`Modern Campus flow failed, trying alternative approaches: ${getErrorMessage(sessionError)}`);
      
      // Try multiple fallback approaches specific to Modern Campus
      try {
        // Approach 1: Try with browser automation headers
        logger.info(`Fallback 1: Enhanced browser simulation`);
        const browserInstance = createAxiosInstance();
        browserInstance.defaults.headers['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
        browserInstance.defaults.headers['Sec-Ch-Ua-Mobile'] = '?0';
        browserInstance.defaults.headers['Sec-Ch-Ua-Platform'] = '"Windows"';
        browserInstance.defaults.headers['Sec-Fetch-User'] = '?1';
        
        response = await browserInstance.get(url);
      } catch (browserError) {
        try {
          // Approach 2: Try accessing via different portal endpoints
          logger.info(`Fallback 2: Alternative portal endpoints`);
          const altInstance = createAxiosInstance();
          
          // Try common Modern Campus endpoints
          const portalBase = url.substring(0, url.indexOf('/portal/') + 8);
          const alternativeUrls = [
            url.replace('studentForgotPassword.do', 'forgotPassword.do'),
            url.replace('portal/', 'portal/index.do?'),
            `${portalBase}index.do`,
            url + '?method=load'
          ];
          
          let worked = false;
          for (const altUrl of alternativeUrls) {
            try {
              logger.info(`Trying alternative URL: ${altUrl}`);
              response = await altInstance.get(altUrl);
              if (response.status < 400) {
                worked = true;
                break;
              }
            } catch (altError) {
              continue;
            }
          }
          
          if (!worked) {
            throw new Error('All alternative URLs failed');
          }
          
        } catch (altError) {
          // Approach 3: Minimal session with just cookies
          logger.info(`Fallback 3: Minimal session approach`);
          const minimalInstance = createAxiosInstance();
          
          // Set some common Modern Campus session values
          minimalInstance.defaults.headers['Cookie'] = 'JSESSIONID=new; portalSession=active';
          minimalInstance.defaults.headers['Cache-Control'] = 'no-cache';
          minimalInstance.defaults.headers['Pragma'] = 'no-cache';
          
          response = await minimalInstance.get(url);
        }
      }
    }
    
    // Check if we got a successful response
    if (response.status >= 400) {
      // For Modern Campus portals, try specific workarounds
      if (url.includes('portal') && response.status === 400) {
        logger.info(`HTTP 400 on Modern Campus portal, attempting specialized methods`);
        try {
          const mcInstance = createAxiosInstance();
          
          // Modern Campus often requires these specific headers
          mcInstance.defaults.headers['X-Requested-With'] = 'XMLHttpRequest';
          mcInstance.defaults.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
          mcInstance.defaults.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
          
          // Try POST with empty body (some Modern Campus endpoints expect this)
          response = await mcInstance.post(url, new URLSearchParams(), {
            headers: {
              'Content-Length': '0'
            }
          });
          
          if (response.status >= 400) {
            // Try with a method parameter
            const urlWithMethod = new URL(url);
            urlWithMethod.searchParams.set('method', 'forgotPassword');
            response = await mcInstance.get(urlWithMethod.toString());
          }
          
        } catch (mcError) {
          logger.warn(`Modern Campus specialized methods failed: ${getErrorMessage(mcError)}`);
        }
      }
      
      if (response.status >= 400) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText || 'Unknown Error'}`;
        logger.error(`All attempts failed for ${url}: ${errorMsg}`);
        
        // Provide helpful error message for Modern Campus portals
        let helpfulError = errorMsg;
        if (url.includes('portal') && response.status === 400) {
          if (url.endsWith('.do')) {
            helpfulError = `${errorMsg} - This Modern Campus portal endpoint (${url}) is a form action processor that expects specific POST data. The endpoint likely requires:
            
• Valid session tokens (Struts token)
• Form fields (email address, student ID, etc.)
• reCAPTCHA verification
• Proper referrer chain

The forgot password/username functionality is typically embedded in the login form at the portal's main login page, rather than being directly accessible at this .do endpoint.

To access this functionality, users would normally:
1. Visit the login page
2. Click "Forgot Password/Username" 
3. Fill out the form with their email
4. Complete reCAPTCHA verification
5. Submit the form to this endpoint

The scraper successfully established a session and followed the proper authentication flow, but cannot complete the final form submission without user-specific data (email address and reCAPTCHA).`;
          } else {
            helpfulError = `${errorMsg} - This Modern Campus portal page requires active user authentication. The page might only be accessible to logged-in users.`;
          }
        }
        
        return {
          url,
          title: "",
          headings: { h1: "", h2: "" },
          metaDescription: "",
          content: "",
          error: helpfulError,
        };
      }
    }

    // Check if response has content
    if (!response.data) {
      logger.error(`No content received from ${url}`);
      return {
        url,
        title: "",
        headings: { h1: "", h2: "" },
        metaDescription: "",
        content: "",
        error: "No content received",
      };
    }

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $("script, style, noscript, iframe, nav, header, footer, aside, .advertisement, .ad, .ads").remove();

    const title = $("title").text();
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    
    const h1 = $("h1")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const h2 = $("h2")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const articleText = $("article")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const mainText = $("main")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const contentText = $('.content, #content, [class*="content"], .post, .entry, .form-container, .portal-content')
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const paragraphs = $("p")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");
    
    const listItems = $("li")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");

    // Also capture form elements and labels for portal pages
    const formElements = $("form, label, .form-group, .field-label")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");

    let combinedContent = [
      title,
      metaDescription,
      h1,
      h2,
      articleText,
      mainText,
      contentText,
      paragraphs,
      listItems,
      formElements,
    ].join(" ");

    combinedContent = cleanText(combinedContent).slice(0, 40000);

    const finalResponse = {
      url,
      title: cleanText(title),
      headings: {
        h1: cleanText(h1),
        h2: cleanText(h2),
      },
      metaDescription: cleanText(metaDescription),
      content: combinedContent,
      error: null,
    };

    await cacheContent(url, finalResponse);
    logger.info(`Successfully scraped and cached content for: ${url}`);
    return finalResponse;
    
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Error scraping ${url}: ${errorMessage}`);
    
    return {
      url,
      title: "",
      headings: { h1: "", h2: "" },
      metaDescription: "",
      content: "",
      error: errorMessage,
    };
  }
}

export interface ScrapedContent {
  url: string;
  title: string;
  headings: {
    h1: string;
    h2: string;
  };
  metaDescription: string;
  content: string;
  error: string | null;
  cachedAt?: number;
}

function isValidScrapedContent(data: any): data is ScrapedContent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.url === "string" &&
    typeof data.title === "string" &&
    typeof data.headings === 'object' &&
    typeof data.headings.h1 === "string" &&
    typeof data.headings.h2 === "string" &&
    typeof data.metaDescription === "string" &&
    typeof data.content === "string" &&
    (data.error === null || typeof data.error === "string")
  );
}

function getCacheKey(url: string): string {
  const sanitizedUrl = url.substring(0, 200);
  return `scrape:${sanitizedUrl}`;
}

async function getCachedContent(url: string): Promise<ScrapedContent | null> {
  try {
    const cacheKey = getCacheKey(url);
    logger.info(`Checking cache for key: ${cacheKey}`);
    const cached = await redis.get(cacheKey);

    if (!cached) {
      logger.info(`Cache miss - No cached content found for: ${url}`);
      return null;
    }

    logger.info(`Cache hit - Found cached content for: ${url}`);

    let parsed: any;
    if (typeof cached === "string") {
      try {
        parsed = JSON.parse(cached);
      } catch (parseError) {
        logger.error(`JSON parse error for cached content: ${parseError}`);
        await redis.del(cacheKey);
        return null;
      }
    } else {
      parsed = cached;
    }

    if (isValidScrapedContent(parsed)) {
      const age = Date.now() - (parsed.cachedAt || 0);
      logger.info(`Cached content age: ${Math.round(age / 1000 / 60)} minutes`);
      return parsed;
    }

    logger.warn(`Invalid cached content found for URL: ${url}`);
    await redis.del(cacheKey);
    return null;
  } catch (error) {
    logger.error(`Cache retrieval error: ${error}`);
    return null;
  }
}

async function cacheContent(url: string, content: ScrapedContent): Promise<void> {
  try {
    const cacheKey = getCacheKey(url);
    content.cachedAt = Date.now();

    if (!isValidScrapedContent(content)) {
      logger.error(`Attempted to cache invalid content format for URL: ${url}`);
      return;
    }

    const serialized = JSON.stringify(content);

    if (serialized.length > MAX_CACHE_SIZE) {
      logger.warn(
        `Content too large to cache for URL: ${url} (${serialized.length} bytes)`
      );
      return;
    }

    await redis.set(cacheKey, serialized, { ex: CACHE_TTL });
    logger.info(
      `Successfully cached content for: ${url} (${serialized.length} bytes, TTL: ${CACHE_TTL} seconds)`
    );
  } catch (error) {
    logger.error(`Cache storage error: ${error}`);
  }
}

export async function saveConversation(id: string, messages: Message[]) {
  try {
    logger.info(`Saving conversation with ID: ${id}`);
    await redis.set(`conversation:${id}`, JSON.stringify(messages));
    await redis.expire(`conversation:${id}`, 60 * 60 * 24 * 7);
    logger.info(
      `Successfully saved conversation with ID: ${id} with ${messages.length} messages. (TTL: 7 days)`
    );
  } catch (error) {
    logger.error(`Error saving conversation with ID: ${id}: ${error}`);
    throw error;
  }
}

export async function getConversation(id: string): Promise<Message[] | null> {
  try {
    logger.info(`Retrieving conversation with ID: ${id}`);
    const data = await redis.get(`conversation:${id}`);

    if (!data) {
      logger.info(`No conversation found for ID: ${id}`);
      return null;
    }

    if (typeof data === "string") {
      const messages = JSON.parse(data);
      logger.info(
        `Successfully retrieved conversation with ID: ${id} with ${messages.length} messages`
      );
      return messages;
    }
    
    logger.info(`Successfully retrieved conversation for ID: ${id}`);
    return data as Message[];
  } catch (error) {
    logger.error(`Error retrieving conversation with ID: ${id}: ${error}`);
    return null;
  }
}