'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Plus, Edit, BarChart2, BookOpen, Trash2, ExternalLink, Lock, Copy } from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'guide'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchQuizzes();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234';
    if (passwordInput === adminPw) {
      sessionStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
      fetchQuizzes();
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('퀴즈 불러오기 오류:', error);
    } else {
      setQuizzes((data || []).map((q) => ({ ...q, is_active: q.is_active ?? true })));
    }
    setLoading(false);
  };

  const handleCreateQuiz = async () => {
    const randomSlug = 'quiz-' + Math.random().toString(36).substring(2, 8);
    const { data, error } = await supabase
      .from('quizzes')
      .insert([
        {
          title: '새로운 사내 교육 퀴즈',
          slug: randomSlug,
          description: '',
          show_title: true,
          require_name: true,
          show_score: true,
          is_active: true,
          result_badge_text: '{name}님의 응시 결과',
        },
      ])
      .select()
      .single();

    if (error) {
      alert('퀴즈 생성 중 오류가 발생했습니다: ' + error.message);
      return;
    }

    if (data) {
      await supabase.from('result_tiers').insert([
        {
          quiz_id: data.id,
          min_score: 0,
          max_score: 100,
          title: '수고하셨습니다!',
          message: '교육 퀴즈 응시가 완료되었습니다.',
        },
      ]);
      router.push(`/admin/edit/${data.id}`);
    }
  };

  // 개선사항 1: 퀴즈 통째로 복제하기 (디자인 + 문제 + 결과구간 모두 복사)
  const handleDuplicateQuiz = async (quizId: string) => {
    const { data: origQuiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (!origQuiz) return;

    const newSlug = `${origQuiz.slug}-copy-${Math.random().toString(36).substring(2, 5)}`;
    const { id, created_at, ...quizProps } = origQuiz;

    const { data: newQuiz, error } = await supabase
      .from('quizzes')
      .insert([
        {
          ...quizProps,
          title: `${origQuiz.title} (복사본)`,
          slug: newSlug,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error || !newQuiz) {
      alert('퀴즈 복제 중 오류가 발생했습니다.');
      return;
    }

    // 기존 문제 복제
    const { data: origQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (origQuestions && origQuestions.length > 0) {
      const clonedQuestions = origQuestions.map(({ id: qId, quiz_id, ...qProps }) => ({
        ...qProps,
        quiz_id: newQuiz.id,
      }));
      await supabase.from('questions').insert(clonedQuestions);
    }

    // 기존 결과 구간 복제
    const { data: origTiers } = await supabase.from('result_tiers').select('*').eq('quiz_id', quizId);
    if (origTiers && origTiers.length > 0) {
      const clonedTiers = origTiers.map(({ id: tId, quiz_id, ...tProps }) => ({
        ...tProps,
        quiz_id: newQuiz.id,
      }));
      await supabase.from('result_tiers').insert(clonedTiers);
    }

    alert('퀴즈가 복제되었습니다!');
    fetchQuizzes();
  };

  // 개선사항 3: 진행 중 / 마감 상태 즉시 전환
  const handleToggleActive = async (quiz: Quiz) => {
    const nextState = !quiz.is_active;
    const { error } = await supabase.from('quizzes').update({ is_active: nextState }).eq('id', quiz.id);
    if (!error) {
      setQuizzes(quizzes.map((q) => (q.id === quiz.id ? { ...q, is_active: nextState } : q)));
    }
  };

  const handleDeleteQuiz = async (id: string, title: string) => {
    if (!confirm(`'${title}' 퀴즈를 정말 삭제하시겠습니까?\n관련된 문제와 응시 결과도 모두 삭제됩니다.`)) return;
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (!error) {
      fetchQuizzes();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
          <div className="flex justify-center mb-4 text-blue-600">
            <Lock size={40} />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800 mb-2">사내 교육 퀴즈 관리자</h1>
          <p className="text-sm text-center text-slate-500 mb-6">관리자 비밀번호를 입력해주세요.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            접속하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-blue-600">🎓 사내 교육 퀴즈 스튜디오</h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setActiveMenu('quizzes')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeMenu === 'quizzes' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                퀴즈 관리
              </button>
              <button
                onClick={() => router.push('/admin/results')}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition"
              >
                <BarChart2 size={16} /> 결과 제어(통계)
              </button>
              <button
                onClick={() => setActiveMenu('guide')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition ${
                  activeMenu === 'guide' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen size={16} /> 사용법 설명
              </button>
            </nav>
          </div>
          {activeMenu === 'quizzes' && (
            <button
              onClick={handleCreateQuiz}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus size={18} /> 새 퀴즈 만들기
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeMenu === 'quizzes' ? (
          <div>
            <h2 className="text-xl font-bold mb-6">만들어진 퀴즈 목록 ({quizzes.length}개)</h2>
            {loading ? (
              <p className="text-slate-500">퀴즈 목록을 불러오는 중입니다...</p>
            ) : quizzes.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                <p className="text-slate-500 mb-4">아직 생성된 교육 퀴즈가 없습니다.</p>
                <button
                  onClick={handleCreateQuiz}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Plus size={18} /> 첫 번째 퀴즈 만들기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      {/* 상단 상태 토글 & 복제/삭제 아이콘 */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => handleToggleActive(quiz)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full transition ${
                            quiz.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title="클릭하여 진행 중 / 마감 상태를 전환합니다"
                        >
                          {quiz.is_active ? '● 진행 중' : '■ 응시 마감됨'}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDuplicateQuiz(quiz.id)}
                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition"
                            title="이 퀴즈 복제하기"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition"
                            title="퀴즈 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-lg text-slate-900 line-clamp-1 mb-1">{quiz.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{quiz.description || ''}</p>
                      <div className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded mb-4 font-mono truncate">
                        공유 경로: /q/{quiz.slug}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => router.push(`/admin/edit/${quiz.id}`)}
                        className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
                      >
                        <Edit size={15} /> 편집하기
                      </button>
                      <a
                        href={`/q/${quiz.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center justify-center"
                        title="퀴즈 실행 미리보기"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 상세 사용 매뉴얼 (전체 기능 반영) */
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-4xl mx-auto shadow-sm space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-900">📘 사내 교육 퀴즈 스튜디오 상세 매뉴얼</h2>
            </div>

            {/* 1단계 */}
            <div className="p-6 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2.5">
              <h3 className="font-bold text-lg text-blue-900">1. 퀴즈 생성·복제 및 응시 기간(마감) 제어</h3>
              <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li><strong>새 퀴즈 만들기:</strong> 우측 상단의 <code>[+ 새 퀴즈 만들기]</code> 버튼을 누르면 새 퀴즈가 생성되며 즉시 편집 화면으로 이동합니다.</li>
                <li><strong>기존 퀴즈 복제하기:</strong> 퀴즈 카드 우측 상단의 <strong>복사 아이콘(❐)</strong>을 누르면 테마 디자인, 출제된 문제, 결과 구간 설정까지 그대로 복제된 새 퀴즈가 만들어집니다. 정기 교육 시 템플릿처럼 활용하세요.</li>
                <li><strong>진행 중 / 응시 마감 토글:</strong> 카드 좌측 상단의 <code>[● 진행 중]</code> 배지를 클릭하면 즉시 <code>[■ 응시 마감됨]</code> 상태로 전환됩니다. 마감된 링크로 직원이 접속하면 안내 화면이 뜨며 더 이상 응시할 수 없습니다.</li>
                <li><strong>커스텀 링크 공유:</strong> 에디터 상단 파란색 <code>[실행 및 공유]</code> 버튼을 누르면 현재 내용이 저장되며 공유 팝업이 열립니다. <code>/q/</code> 뒷부분에 원하는 영문·숫자(예: <code>2026-security</code>)를 입력하고 <code>[적용]</code>을 누르세요.</li>
              </ul>
            </div>

            {/* 2단계 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <h3 className="font-bold text-lg text-slate-900">2. 메인 페이지 편집 탭 (시작 화면 디자인)</h3>
              <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li><strong>화면 비율 기준:</strong> PC와 모바일 모두 동일한 비율로 깔끔하게 보이도록 <strong>세로형(9:16 비율, 권장 크기 1080×1920px)</strong>을 기준으로 작동합니다.</li>
                <li><strong>포스터형 시작 화면 팁:</strong> 이미 제목과 문구가 디자인된 포스터 이미지를 배경으로 넣으실 경우, <strong>[시작 화면에 제목 표시] 체크 해제</strong> + <strong>[안내 문구] 빈칸</strong> + <strong>[응시자 성명/부서 입력칸] 체크 해제</strong>로 설정하시면 가운데 흰색 박스 없이 깔끔하게 <strong>배경 이미지와 시작 버튼만</strong> 노출됩니다.</li>
                <li><strong>배경 이미지 삭제:</strong> 등록된 배경 이미지를 내리고 단색으로 돌아가고 싶을 때는 이미지 적용 안내 옆의 <code>[이미지 지우기]</code> 버튼을 누르세요.</li>
                <li><strong>색상 커스텀:</strong> 메인 포인트 색상(상단 진행도 바, 선택된 보기 테두리), 기본 글씨 색상, 시작 버튼 문구·배경색·글씨색을 자유롭게 지정하고 우측 미리보기로 즉시 확인할 수 있습니다.</li>
              </ul>
            </div>

            {/* 3단계 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <h3 className="font-bold text-lg text-slate-900">3. 문제 편집 탭 (문항 출제·순서 이동 및 개별 배경)</h3>
              <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li><strong>문제 순서 이동 (▲ / ▼):</strong> 각 문제 카드 우측 상단의 <code>▲</code>, <code>▼</code> 화살표 버튼을 눌러 문제 순서를 위아래로 자유롭게 바꿀 수 있습니다.</li>
                <li><strong>객관식 출제:</strong> <code>[+ 보기 추가하기]</code>로 선택지를 늘릴 수 있으며, 정답인 보기 왼쪽의 <strong>동그라미(◉)</strong>를 반드시 클릭해 정답을 지정해야 합니다.</li>
                <li><strong>O / X 퀴즈 출제:</strong> <code>O</code> 또는 <code>X</code> 버튼을 클릭해 정답을 지정합니다.</li>
                <li><strong>주관식 채점 규칙:</strong> 직원이 입력한 답안과 설정한 정답을 비교할 때 <strong>띄어쓰기와 영문 대·소문자를 자동으로 무시</strong>하고 일치하면 정답으로 인정합니다. (예: 정답이 <code>정보보호</code>일 때 <code>정보 보호</code>라고 입력해도 정답 처리)</li>
                <li><strong>문항별 개별 배경 & 미리보기:</strong> 각 문제 카드 하단에서 해당 문제만 다른 단색이나 이미지를 띄울 수 있습니다. 문제 카드를 클릭하면 우측 스마트폰 화면에서 해당 문제의 실제 모습을 미리 볼 수 있습니다.</li>
              </ul>
            </div>

            {/* 4단계 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <h3 className="font-bold text-lg text-slate-900">4. 결과 편집 탭 (점수 구간별 안내 및 디자인)</h3>
              <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li><strong>결과 페이지 전용 배경 및 글씨색:</strong> 시작 화면과 다르게 결과 페이지만 별도의 단색이나 축하 이미지를 띄울 수 있습니다.</li>
                <li><strong>상단 배지 커스텀:</strong> 결과 카드 맨 위 뱃지 문구에서 <code>{'{name}'}</code>을 입력하면 응시자 이름으로 자동 변환됩니다. 배지 자체를 숨기고 싶다면 입력칸을 완전히 비워두세요.</li>
                <li><strong>점수 표시 숨기기:</strong> 점수 공개가 불필요한 설문·교육의 경우 <code>[획득 점수 표시]</code> 체크를 해제하면 점수 숫자 없이 결과 타이틀과 멘트만 노출됩니다.</li>
                <li><strong>점수 구간 설정:</strong> <code>[+ 구간 추가]</code>를 눌러 <code>0~59점</code>, <code>60~100점</code>처럼 점수대별 결과 타이틀과 안내 멘트를 다르게 설정할 수 있습니다. (멘트를 비워두면 빈 박스 없이 타이틀만 깔끔하게 표시됩니다.)</li>
              </ul>
            </div>

            {/* 5단계 */}
            <div className="p-6 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2.5">
              <h3 className="font-bold text-lg text-emerald-900">5. 결과 제어(통계) 탭 활용 및 데이터 관리</h3>
              <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li><strong>퀴즈별 조회:</strong> 상단 선택 박스에서 분석할 퀴즈를 고르면 총 응시 인원, 평균 점수, 가장 오답률이 높은 취약 문항이 자동 계산됩니다.</li>
                <li><strong>오답률 분석 & 분포 확인:</strong> 오답률이 50% 이상인 문항은 빨간색 막대로 강조 표시되며, 우측 목록에서 각 보기별로 몇 명이 선택했는지 비율을 확인할 수 있습니다.</li>
                <li><strong>테스트 기록 삭제 & 전체 초기화:</strong> 실제 직원 배포 전 관리자가 테스트로 풀어본 기록은 표 우측의 <strong>휴지통 아이콘</strong>으로 개별 삭제하거나, 상단의 <code>[전체 기록 초기화]</code> 버튼으로 한 번에 비울 수 있습니다.</li>
                <li><strong>개인별 상세 답안 및 엑셀 저장:</strong> 하단 응시자 표에서 <code>[답안지 확인]</code>을 누르면 해당 직원이 틀린 문제와 제출 답안을 상세히 볼 수 있고, <code>[엑셀(CSV) 저장]</code> 버튼으로 전체 결과를 파일로 내려받을 수 있습니다.</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}