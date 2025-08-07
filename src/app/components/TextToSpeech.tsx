"use client";

import { useState, useRef, useEffect } from "react";
import { VolumeXIcon, Volume2Icon, PauseIcon, PlayIcon } from "lucide-react";

interface TextToSpeechProps {
  text: string;
  className?: string;
}

export default function TextToSpeech({
  text,
  className = "",
}: TextToSpeechProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [usingElevenLabs, setUsingElevenLabs] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // ElevenLabs configuration
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const VOICE_ID = "uYXf8XasLslADfZ2MB4u"; // Your specified voice ID
  const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  useEffect(() => {
    // Check if speech synthesis is supported (fallback)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      // Load voices for fallback
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      };

      loadVoices();

      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      // Cleanup function
      return () => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, []);

  const cleanTextForSpeech = (rawText: string): string => {
    return (
      rawText
        // Remove markdown formatting
        .replace(/\*\*(.*?)\*\*/g, "$1") // Bold text
        .replace(/\*(.*?)\*/g, "$1") // Italic text
        .replace(/`(.*?)`/g, "$1") // Code blocks
        .replace(/#{1,6}\s/g, "") // Headers
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1") // Links - keep only the text
        // Remove HTML tags
        .replace(/<[^>]*>/g, "")
        // Remove emojis and special characters
        .replace(/[📞📧🕒🎉✅💡⏱️]/g, "")
        // Clean up phone numbers and emails for better pronunciation
        .replace(/808-842-2563/g, "8 0 8, 8 4 2, 2 5 6 3")
        .replace(/uhcccewd@hawaii\.edu/g, "U H C C C E W D at hawaii dot edu")
        // Replace URLs with friendlier speech
        .replace(/https?:\/\/[^\s]+/g, "link")
        // Add pauses for better pacing (works especially well with ElevenLabs)
        .replace(/\./g, "... ") // Longer pause after sentences
        .replace(/,/g, ", ") // Short pause after commas
        .replace(/:/g, ": ") // Pause after colons
        .replace(/;/g, "; ") // Pause after semicolons
        // Clean up multiple spaces and newlines
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  const getBestVoice = (): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    const englishVoices = voices.filter(
      voice => voice.lang.startsWith("en-") && voice.localService
    );

    const friendlyVoices = englishVoices.filter(
      voice =>
        voice.name.toLowerCase().includes("female") ||
        voice.name.toLowerCase().includes("samantha") ||
        voice.name.toLowerCase().includes("karen") ||
        voice.name.toLowerCase().includes("susan") ||
        voice.name.toLowerCase().includes("zira")
    );

    if (friendlyVoices.length > 0) {
      return friendlyVoices[0];
    }

    if (englishVoices.length > 0) {
      return englishVoices[0];
    }

    return voices[0];
  };

  const generateElevenLabsAudio = async (
    text: string
  ): Promise<string | null> => {
    if (!ELEVENLABS_API_KEY) {
      console.log("ElevenLabs API key not found, falling back to browser TTS");
      return null;
    }

    try {
      setIsLoading(true);

      const response = await fetch(ELEVENLABS_URL, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          },
          // Add pronunciation dictionary for slower, clearer speech
          pronunciation_dictionary_locators: [],
          // This helps with pacing
          seed: null,
          previous_text: null,
          next_text: null,
          previous_request_ids: [],
          next_request_ids: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      return audioUrl;
    } catch (error) {
      console.error("ElevenLabs TTS failed:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const playWithElevenLabs = async (text: string): Promise<boolean> => {
    const audioUrl = await generateElevenLabsAudio(text);

    if (!audioUrl) {
      return false;
    }

    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Slow down the audio playback rate for ElevenLabs
      audio.playbackRate = 0.85; // 85% of normal speed

      audio.onloadeddata = () => {
        setIsLoading(false);
        setIsPlaying(true);
        setIsPaused(false);
        setUsingElevenLabs(true);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setUsingElevenLabs(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl); // Clean up blob URL
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setUsingElevenLabs(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onpause = () => {
        setIsPaused(true);
        setIsPlaying(false);
        setIsLoading(false);
      };

      audio.onplay = () => {
        setIsPaused(false);
        setIsPlaying(true);
        setIsLoading(false);
      };

      await audio.play();
      return true;
    } catch (error) {
      console.error("Audio playback failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  const playWithBrowserTTS = (text: string) => {
    setIsLoading(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    const bestVoice = getBestVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.rate = 0.75; // Slower rate for browser TTS (75% of normal speed)
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
      setIsPaused(false);
      setUsingElevenLabs(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    utterance.onerror = event => {
      console.error("Speech synthesis error:", event);
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
      setIsPlaying(false);
      setIsLoading(false);
    };

    utterance.onresume = () => {
      setIsPaused(false);
      setIsPlaying(true);
      setIsLoading(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleClick = () => {
    if (!isSupported || isLoading) return; // Prevent clicks during loading

    // If currently playing, pause it
    if (isPlaying && !isPaused) {
      if (usingElevenLabs && audioRef.current) {
        audioRef.current.pause();
      } else {
        window.speechSynthesis.pause();
      }
      return;
    }

    // If paused, resume
    if (isPaused) {
      if (usingElevenLabs && audioRef.current) {
        audioRef.current.play();
      } else {
        window.speechSynthesis.resume();
      }
      return;
    }

    // If stopped/not started, start new speech
    if (!isPlaying && !isPaused) {
      startSpeech();
    }
  };

  const stopSpeech = () => {
    if (usingElevenLabs && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setUsingElevenLabs(false);
    setIsLoading(false);
  };

  const startSpeech = async () => {
    const cleanText = cleanTextForSpeech(text);

    if (!cleanText.trim()) return;

    // Try ElevenLabs first
    const elevenLabsSuccess = await playWithElevenLabs(cleanText);

    // If ElevenLabs fails, fall back to browser TTS
    if (!elevenLabsSuccess) {
      console.log("Falling back to browser TTS");
      playWithBrowserTTS(cleanText);
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        onMouseDown={e => e.preventDefault()}
        disabled={isLoading}
        className={`
          inline-flex items-center justify-center
          w-8 h-8 rounded-full
          ${
            isLoading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : usingElevenLabs
                ? "bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-700"
                : "bg-amber-100 hover:bg-amber-200 text-amber-600 hover:text-amber-700"
          }
          transition-all duration-200
          ${!isLoading && "hover:scale-110 active:scale-95"}
          focus:outline-none ${usingElevenLabs ? "focus:ring-purple-400" : "focus:ring-amber-400"} focus:ring-offset-1
          shadow-sm ${!isLoading && "hover:shadow-md"}
          ${className}
        `}
        title={
          isLoading
            ? "Loading audio..."
            : isPlaying && !isPaused
              ? `Pause reading${usingElevenLabs ? " (ElevenLabs)" : " (Browser)"}`
              : isPaused
                ? `Resume reading${usingElevenLabs ? " (ElevenLabs)" : " (Browser)"}`
                : "Read message aloud"
        }
        type="button"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying && !isPaused ? (
          <PauseIcon size={16} className="animate-pulse" />
        ) : isPaused ? (
          <PlayIcon size={16} />
        ) : (
          <Volume2Icon size={16} />
        )}
      </button>

      {/* Stop button appears when playing or paused */}
      {(isPlaying || isPaused) && (
        <button
          onClick={stopSpeech}
          onMouseDown={e => e.preventDefault()}
          className="
            inline-flex items-center justify-center
            w-6 h-6 rounded-full
            bg-red-100 hover:bg-red-200
            text-red-600 hover:text-red-700
            transition-all duration-200
            hover:scale-110 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1
            shadow-sm hover:shadow-md
          "
          title="Stop reading"
          type="button"
        >
          <VolumeXIcon size={12} />
        </button>
      )}
    </div>
  );
}
