// app/api/surveys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SurveyRequest {
  rating: number;
  feedback?: string;
}

interface SurveyResponse {
  id: string;
  rating: number;
  feedback: string | null;
  createdAt: Date;
}

interface SurveysData {
  surveys: SurveyResponse[];
  average: number;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const { rating, feedback }: SurveyRequest = await request.json();
    
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' }, 
        { status: 400 }
      );
    }

    const result = await prisma.survey.create({
      data: {
        rating,
        feedback: feedback || null,
      },
    });

    return NextResponse.json(
      { success: true, data: result }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to save survey' }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const surveys = await prisma.survey.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const avgResult = await prisma.survey.aggregate({
      _avg: {
        rating: true,
      },
    });

    const responseData: SurveysData = {
      surveys,
      average: avgResult._avg.rating || 0,
      total: surveys.length,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' }, 
      { status: 500 }
    );
  }
}