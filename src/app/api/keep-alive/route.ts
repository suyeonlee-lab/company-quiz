import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // DB가 잠들지 않도록 가벼운 조회 쿼리 1회 실행
  const { error } = await supabase.from('quizzes').select('id').limit(1);

  if (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}
