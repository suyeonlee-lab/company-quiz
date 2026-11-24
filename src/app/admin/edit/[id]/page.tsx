'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Play,
  Copy,
  Check,
  Palette,
  ListChecks,
  Award,
  Plus,
  Trash2,
  Upload,
  X,
  Smartphone,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface QuizData {
  id: string;
  title: string;
  slug: string;
  description: string;
  show_title: boolean;
  require_name: boolean;
  show_score: boolean;
  is_active: boolean;
  result_badge_text: string;
  bg_type: 'color' | 'image';
  bg_color: string;
  bg_image_url: string;
  main_color: string;
  text_color: string;
  btn_text: string;
  btn_color: string;
  btn_text_color: string;
  result_bg_type: 'inherit' | 'color' | 'image';
  result_bg_color: string;
  result_bg_image_url: string;
  result_text_color: string;
}

interface Question {
  id?: string;
  quiz_id: string;
  type: 'multiple' | 'ox' | 'short';
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  bg_type: 'inherit' | 'color' | 'image';
  bg_color: string;
  bg_image_url: string;
}

interface ResultTier {
  id?: string;
  quiz_id: string;
  min_score: number;
  max_score: number;
  title: string;
  message: string;
}

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'main' | 'questions' | 'results'>('main');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tiers, setTiers] = useState<ResultTier[]>([]);
  const [previewQIdx, setPreviewQIdx] = useState<number>(0);
  const [previewTierIdx, setPreviewTierIdx] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [quizId]);

  const fetchAllData = async () => {
    const { data: qData } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (qData) {
      setQuiz({
        ...qData,
        show_title: qData.show_title ?? true,
        require_name: qData.require_name ?? true,
        show_score: qData.show_score ?? true,
        is_active: qData.is_active ?? true,
        result_badge_text: qData.result_badge_text ?? '{name}님의 응시 결과',
        result_bg_type: qData.result_bg_type || 'inherit',
        result_bg_color: qData.result_bg_color || '#f8fafc',
        result_bg_image_url: qData.result_bg_image_url || '',
        result_text_color: qData.result_text_color || qData.text_color || '#0f172a',
      });
    }

    const { data: quesData } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });
    if (quesData) {
      setQuestions(
        quesData.map((q) => ({
          ...q,
          bg_type: q.bg_type || 'inherit',
          bg_color: q.bg_color || '#f8fafc',
          bg_image_url: q.bg_image_url || '',
        }))
      );
    }

    const { data: tierData } = await supabase
      .from('result_tiers')
      .select('*')
      .eq('quiz_id', quizId)
      .order('min_score', { ascending: true });
    if (tierData) setTiers(tierData);
  };

  const handleSaveAll = async () => {
    if (!quiz) return;
    setSaving(true);

    const { error: quizError } = await supabase
      .from('quizzes')
      .update({
        title: quiz.title,
        slug: quiz.slug.trim().replace(/[^a-zA-Z0-9-_]/g, '-'),
        description: quiz.description,
        show_title: quiz.show_title,
        require_name: quiz.require_name,
        show_score: quiz.show_score,
        is_active: quiz.is_active,
        result_badge_text: quiz.result_badge_text,
        bg_type: quiz.bg_type,
        bg_color: quiz.bg_color,
        bg_image_url: quiz.bg_image_url,
        main_color: quiz.main_color,
        text_color: quiz.text_color,
        btn_text: quiz.btn_text,
        btn_color: quiz.btn_color,
        btn_text_color: quiz.btn_text_color,
        result_bg_type: quiz.result_bg_type,
        result_bg_color: quiz.result_bg_color,
        result_bg_image_url: quiz.result_bg_image_url,
        result_text_color: quiz.result_text_color,
      })
      .eq('id', quizId);

    if (quizError) {
      alert('저장 오류 (링크 주소 중복 등을 확인하세요): ' + quizError.message);
      setSaving(false);
      return;
    }

    await supabase.from('questions').delete().eq('quiz_id', quizId);
    if (questions.length > 0) {
      const toInsertQuestions = questions.map((q, idx) => ({
        quiz_id: quizId,
        type: q.type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        points: Number(q.points) || 10,
        order_index: idx,
        bg_type: q.bg_type || 'inherit',
        bg_color: q.bg_color || '#f8fafc',
        bg_image_url: q.bg_image_url || '',
      }));
      await supabase.from('questions').insert(toInsertQuestions);
    }

    await supabase.from('result_tiers').delete().eq('quiz_id', quizId);
    if (tiers.length > 0) {
      const toInsertTiers = tiers.map((t) => ({
        quiz_id: quizId,
        min_score: Number(t.min_score) || 0,
        max_score: Number(t.max_score) || 100,
        title: t.title,
        message: t.message,
      }));
      await supabase.from('result_tiers').insert(toInsertTiers);
    }

    await fetchAllData();
    setSaving(false);
    alert('모든 변경사항이 저장되었습니다!');
  };

  // 개선사항 2: 문제 순서 위/아래 이동
  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setQuestions(updated);
    setPreviewQIdx(targetIdx);
  };

  const uploadImageFile = async (file: File, prefix: string): Promise<string | null> => {
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${quizId}-${prefix}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('quiz-images').upload(fileName, file);
    if (uploadError) {
      alert('이미지 업로드 실패: ' + uploadError.message);
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
    setUploading(false);
    return data.publicUrl;
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quiz) return;
    const url = await uploadImageFile(file, 'main');
    if (url) setQuiz({ ...quiz, bg_type: 'image', bg_image_url: url });
  };

  const handleQuestionImageUpload = async (qIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageFile(file, `q${qIdx}`);
    if (url) {
      const updated = [...questions];
      updated[qIdx].bg_type = 'image';
      updated[qIdx].bg_image_url = url;
      setQuestions(updated);
    }
  };

  const handleResultImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quiz) return;
    const url = await uploadImageFile(file, 'result');
    if (url) setQuiz({ ...quiz, result_bg_type: 'image', result_bg_image_url: url });
  };

  const addQuestion = (type: 'multiple' | 'ox' | 'short') => {
    let defaultOptions: string[] = [];
    let defaultAnswer = '';

    if (type === 'multiple') {
      defaultOptions = ['보기 1', '보기 2'];
      defaultAnswer = '보기 1';
    } else if (type === 'ox') {
      defaultOptions = ['O', 'X'];
      defaultAnswer = 'O';
    }

    const newList: Question[] = [
      ...questions,
      {
        quiz_id: quizId,
        type,
        question_text: '',
        options: defaultOptions,
        correct_answer: defaultAnswer,
        points: 10,
        order_index: questions.length,
        bg_type: 'inherit',
        bg_color: '#f8fafc',
        bg_image_url: '',
      },
    ];
    setQuestions(newList);
    setPreviewQIdx(newList.length - 1);
  };

  const addTier = () => {
    const newTiers = [
      ...tiers,
      {
        quiz_id: quizId,
        min_score: 0,
        max_score: 100,
        title: '새 결과 등급',
        message: '결과 안내 문구를 입력하세요.',
      },
    ];
    setTiers(newTiers);
    setPreviewTierIdx(newTiers.length - 1);
  };

  const shareUrl = typeof window !== 'undefined' && quiz ? `${window.location.origin}/q/${quiz.slug}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!quiz) return <div className="p-8 text-center text-slate-500">에디터를 불러오는 중...</div>;

  const hasIntroCardContent = quiz.show_title || quiz.description.trim() !== '' || quiz.require_name;

  const activePreviewQ = questions[previewQIdx] || questions[0];
  const getQuestionBgStyle = (q?: Question) => {
    if (!q || q.bg_type === 'inherit') {
      return {
        backgroundColor: quiz.bg_type === 'color' ? quiz.bg_color : '#f8fafc',
        backgroundImage: quiz.bg_type === 'image' && quiz.bg_image_url ? `url(${quiz.bg_image_url})` : 'none',
      };
    }
    if (q.bg_type === 'color') {
      return { backgroundColor: q.bg_color, backgroundImage: 'none' };
    }
    return {
      backgroundColor: '#f8fafc',
      backgroundImage: q.bg_image_url ? `url(${q.bg_image_url})` : 'none',
    };
  };

  const getResultBgStyle = () => {
    if (quiz.result_bg_type === 'inherit') {
      return {
        backgroundColor: quiz.bg_type === 'color' ? quiz.bg_color : '#f8fafc',
        backgroundImage: quiz.bg_type === 'image' && quiz.bg_image_url ? `url(${quiz.bg_image_url})` : 'none',
      };
    }
    if (quiz.result_bg_type === 'color') {
      return { backgroundColor: quiz.result_bg_color, backgroundImage: 'none' };
    }
    return {
      backgroundColor: '#f8fafc',
      backgroundImage: quiz.result_bg_image_url ? `url(${quiz.result_bg_image_url})` : 'none',
    };
  };

  const activePreviewTier = tiers[previewTierIdx] || tiers[0];
  const previewBadgeText = quiz.result_badge_text
    ? quiz.result_badge_text.replace(/\{name\}/g, '홍길동')
    : '';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* 상단 고정 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            title="목록으로 돌아가기"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-lg text-slate-900 truncate max-w-xs sm:max-w-md">
            {quiz.title || '제목 없는 퀴즈'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 에디터 상단에서도 진행 중 / 마감 전환 가능 */}
          <button
            type="button"
            onClick={() => setQuiz({ ...quiz, is_active: !quiz.is_active })}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
              quiz.is_active
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-100 border-slate-300 text-slate-600'
            }`}
          >
            {quiz.is_active ? '● 진행 중' : '■ 응시 마감됨'}
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Save size={16} /> {saving ? '저장 중...' : '저장하기'}
          </button>
          <button
            onClick={async () => {
              await handleSaveAll();
              setShowShareModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Play size={16} /> 실행 및 공유
          </button>
        </div>
      </header>

      {/* 에디터 3대 탭 메뉴 */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex gap-6 px-4">
          <button
            onClick={() => setActiveTab('main')}
            className={`py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'main'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette size={17} /> 1. 메인 페이지 편집
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'questions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListChecks size={17} /> 2. 문제 편집 ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'results'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award size={17} /> 3. 결과 편집 ({tiers.length})
          </button>
        </div>
      </div>

      {/* 탭 본문 영역 */}
      <main className="max-w-6xl w-full mx-auto p-6 flex-1">
        {/* ==================== 탭 1: 메인 페이지 편집 ==================== */}
        {activeTab === 'main' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-sm">
              <h3 className="font-bold text-base border-b pb-3">메인 화면 & 테마 설정</h3>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">퀴즈 제목</label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quiz.show_title}
                      onChange={(e) => setQuiz({ ...quiz, show_title: e.target.checked })}
                      className="accent-blue-600 rounded"
                    />
                    시작 화면에 제목 표시
                  </label>
                </div>
                <input
                  type="text"
                  value={quiz.title}
                  onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  placeholder="퀴즈 제목을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  퀴즈 안내 문구 (비워두면 화면에 표시되지 않습니다)
                </label>
                <textarea
                  rows={2}
                  value={quiz.description}
                  onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  placeholder="안내 문구가 필요 없으면 비워두세요."
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">응시자 성명 / 부서 입력칸 사용</p>
                  <p className="text-[11px] text-slate-500">끄면 이름 입력 없이 바로 시작하기 버튼만 노출됩니다.</p>
                </div>
                <input
                  type="checkbox"
                  checked={quiz.require_name}
                  onChange={(e) => setQuiz({ ...quiz, require_name: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* 배경 테마: 단색 vs 이미지 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">배경 스타일 선택</label>
                <div className="flex gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setQuiz({ ...quiz, bg_type: 'color' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      quiz.bg_type === 'color'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    단색 색상 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuiz({ ...quiz, bg_type: 'image' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      quiz.bg_type === 'image'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    배경 이미지 넣기
                  </button>
                </div>

                {quiz.bg_type === 'color' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={quiz.bg_color}
                      onChange={(e) => setQuiz({ ...quiz, bg_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border"
                    />
                    <span className="text-sm font-mono text-slate-600">{quiz.bg_color}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                      <Upload size={18} />
                      {uploading ? '업로드 중...' : '배경 이미지 선택 (9:16 비율, 1080x1920px 권장)'}
                      <input type="file" accept="image/*" onChange={handleMainImageUpload} className="hidden" />
                    </label>
                    {quiz.bg_image_url && (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                        <span className="text-xs text-emerald-700 font-semibold">✓ 배경 이미지가 적용되었습니다</span>
                        <button
                          type="button"
                          onClick={() => setQuiz({ ...quiz, bg_image_url: '', bg_type: 'color' })}
                          className="text-xs text-rose-600 hover:underline font-bold flex items-center gap-1"
                        >
                          <Trash2 size={13} /> 이미지 지우기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 색상 커스텀 */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">메인 포인트 색상 (진행바 등)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={quiz.main_color}
                      onChange={(e) => setQuiz({ ...quiz, main_color: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border"
                    />
                    <span className="text-xs font-mono">{quiz.main_color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">기본 글씨 색상</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={quiz.text_color}
                      onChange={(e) => setQuiz({ ...quiz, text_color: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border"
                    />
                    <span className="text-xs font-mono">{quiz.text_color}</span>
                  </div>
                </div>
              </div>

              {/* 시작 버튼 커스텀 */}
              <div className="pt-2 border-t space-y-3">
                <label className="block text-xs font-semibold text-slate-600">퀴즈 시작 버튼 커스텀</label>
                <input
                  type="text"
                  value={quiz.btn_text}
                  onChange={(e) => setQuiz({ ...quiz, btn_text: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="버튼 문구 (예: 퀴즈 풀기)"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">버튼 배경색</span>
                    <input
                      type="color"
                      value={quiz.btn_color}
                      onChange={(e) => setQuiz({ ...quiz, btn_color: e.target.value })}
                      className="w-full h-9 rounded cursor-pointer border"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">버튼 글씨색</span>
                    <input
                      type="color"
                      value={quiz.btn_text_color}
                      onChange={(e) => setQuiz({ ...quiz, btn_text_color: e.target.value })}
                      className="w-full h-9 rounded cursor-pointer border"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 실시간 미리보기 */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                <Smartphone size={15} /> 실제 응시 화면 미리보기 (PC·모바일 동일 비율)
              </p>
              <div
                className="w-[340px] h-[604px] rounded-[36px] border-[8px] border-slate-800 shadow-xl overflow-hidden flex flex-col justify-end p-6 text-center bg-cover bg-center relative transition-all"
                style={{
                  backgroundColor: quiz.bg_type === 'color' ? quiz.bg_color : '#f8fafc',
                  backgroundImage:
                    quiz.bg_type === 'image' && quiz.bg_image_url ? `url(${quiz.bg_image_url})` : 'none',
                  color: quiz.text_color,
                }}
              >
                {hasIntroCardContent ? (
                  <div className="my-auto bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-md w-full">
                    {quiz.show_title && (
                      <h2 className="text-xl font-extrabold mb-2" style={{ color: quiz.text_color }}>
                        {quiz.title || '퀴즈 제목'}
                      </h2>
                    )}
                    {quiz.description.trim() !== '' && (
                      <p className="text-xs mb-5 opacity-85 whitespace-pre-line" style={{ color: quiz.text_color }}>
                        {quiz.description}
                      </p>
                    )}
                    {quiz.require_name && (
                      <div className="mb-4 text-left">
                        <div className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-400 text-xs">
                          응시자 성명 / 부서 입력칸
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      className="w-full py-3 rounded-xl font-bold text-sm shadow transition"
                      style={{
                        backgroundColor: quiz.btn_color,
                        color: quiz.btn_text_color,
                      }}
                    >
                      {quiz.btn_text || '퀴즈 시작하기'}
                    </button>
                  </div>
                ) : (
                  <div className="w-full pb-4">
                    <button
                      type="button"
                      className="w-full py-3.5 rounded-2xl font-bold text-base shadow-lg transition"
                      style={{
                        backgroundColor: quiz.btn_color,
                        color: quiz.btn_text_color,
                      }}
                    >
                      {quiz.btn_text || '퀴즈 시작하기'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 탭 2: 문제 편집 & 미리보기 ==================== */}
        {activeTab === 'questions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <span className="text-sm font-bold text-slate-700">새 문제 추가:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => addQuestion('multiple')}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition"
                  >
                    + 객관식
                  </button>
                  <button
                    onClick={() => addQuestion('ox')}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition"
                  >
                    + O / X 퀴즈
                  </button>
                  <button
                    onClick={() => addQuestion('short')}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition"
                  >
                    + 주관식
                  </button>
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
                  위 버튼을 눌러 첫 번째 교육 문제를 추가해 보세요!
                </div>
              ) : (
                questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    onClick={() => setPreviewQIdx(qIdx)}
                    className={`bg-white p-5 rounded-2xl border-2 transition shadow-sm space-y-4 cursor-pointer ${
                      previewQIdx === qIdx ? 'border-blue-500' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded">
                          문제 {qIdx + 1}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                          {q.type === 'multiple' && '객관식'}
                          {q.type === 'ox' && 'O / X'}
                          {q.type === 'short' && '주관식'}
                        </span>
                        {previewQIdx === qIdx && (
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            미리보기 중
                          </span>
                        )}
                      </div>

                      {/* 개선사항 2: 문제 순서 위/아래 이동 버튼 + 배점 + 삭제 */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden mr-1">
                          <button
                            type="button"
                            disabled={qIdx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(qIdx, 'up');
                            }}
                            className="p-1.5 hover:bg-slate-100 disabled:opacity-25 text-slate-600"
                            title="위로 이동"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={qIdx === questions.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(qIdx, 'down');
                            }}
                            className="p-1.5 hover:bg-slate-100 disabled:opacity-25 text-slate-600 border-l border-slate-200"
                            title="아래로 이동"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        <label className="text-xs text-slate-600 flex items-center gap-1">
                          배점:
                          <input
                            type="number"
                            value={q.points}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[qIdx].points = Number(e.target.value);
                              setQuestions(updated);
                            }}
                            className="w-14 border rounded px-1.5 py-1 text-center font-semibold"
                          />
                          점
                        </label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const filtered = questions.filter((_, i) => i !== qIdx);
                            setQuestions(filtered);
                            setPreviewQIdx(Math.max(0, qIdx - 1));
                          }}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[qIdx].question_text = e.target.value;
                        setQuestions(updated);
                      }}
                      placeholder="질문 내용을 입력하세요..."
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-medium"
                    />

                    {q.type === 'multiple' && (
                      <div className="space-y-2 pl-1">
                        <p className="text-xs font-semibold text-slate-500">
                          보기 목록 (정답인 보기의 왼쪽 동그라미 ◉ 를 클릭해 체크하세요):
                        </p>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correct_answer === opt && opt !== ''}
                              onChange={() => {
                                const updated = [...questions];
                                updated[qIdx].correct_answer = opt;
                                setQuestions(updated);
                              }}
                              className="w-4 h-4 accent-blue-600 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...questions];
                                const wasCorrect = updated[qIdx].correct_answer === opt;
                                updated[qIdx].options[optIdx] = e.target.value;
                                if (wasCorrect) updated[qIdx].correct_answer = e.target.value;
                                setQuestions(updated);
                              }}
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            />
                            {q.options.length > 2 && (
                              <button
                                onClick={() => {
                                  const updated = [...questions];
                                  updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== optIdx);
                                  setQuestions(updated);
                                }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...questions];
                            updated[qIdx].options.push(`보기 ${updated[qIdx].options.length + 1}`);
                            setQuestions(updated);
                          }}
                          className="text-xs text-blue-600 font-semibold hover:underline mt-1"
                        >
                          + 보기 추가하기
                        </button>
                      </div>
                    )}

                    {q.type === 'ox' && (
                      <div className="flex items-center gap-4 pl-1">
                        <span className="text-xs font-semibold text-slate-500">정답 선택:</span>
                        {['O', 'X'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              const updated = [...questions];
                              updated[qIdx].correct_answer = val;
                              setQuestions(updated);
                            }}
                            className={`px-6 py-2 rounded-lg font-bold text-sm border ${
                              q.correct_answer === val
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'short' && (
                      <div className="pl-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          주관식 정답 (띄어쓰기/대소문자 구분 없이 일치하면 정답 처리됨):
                        </label>
                        <input
                          type="text"
                          value={q.correct_answer}
                          onChange={(e) => {
                            const updated = [...questions];
                            updated[qIdx].correct_answer = e.target.value;
                            setQuestions(updated);
                          }}
                          placeholder="정답 단어나 문구를 입력하세요"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    {/* 문제별 개별 배경 커스텀 */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-600">이 문제의 배경 화면 설정:</span>
                        <div className="flex gap-1.5">
                          {[
                            { id: 'inherit', label: '메인 배경 동일' },
                            { id: 'color', label: '단색 지정' },
                            { id: 'image', label: '이미지 넣기' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const updated = [...questions];
                                updated[qIdx].bg_type = opt.id as 'inherit' | 'color' | 'image';
                                setQuestions(updated);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                                q.bg_type === opt.id
                                  ? 'bg-slate-800 text-white border-slate-800'
                                  : 'bg-white text-slate-600 border-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {q.bg_type === 'color' && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="color"
                            value={q.bg_color}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[qIdx].bg_color = e.target.value;
                              setQuestions(updated);
                            }}
                            className="w-9 h-8 rounded border cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-500">{q.bg_color}</span>
                        </div>
                      )}

                      {q.bg_type === 'image' && (
                        <div className="mt-2 space-y-2">
                          <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg p-2.5 cursor-pointer hover:bg-slate-50 text-xs text-slate-600">
                            <Upload size={14} />
                            {uploading ? '업로드 중...' : '이 문제 전용 배경 이미지 선택 (9:16 권장)'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQuestionImageUpload(qIdx, e)}
                              className="hidden"
                            />
                          </label>
                          {q.bg_image_url && (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                              <span className="text-[11px] text-emerald-700 font-semibold">✓ 개별 배경 이미지 적용됨</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...questions];
                                  updated[qIdx].bg_image_url = '';
                                  updated[qIdx].bg_type = 'inherit';
                                  setQuestions(updated);
                                }}
                                className="text-[11px] text-rose-600 hover:underline font-bold flex items-center gap-1"
                              >
                                <Trash2 size={12} /> 이미지 지우기
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-5 flex flex-col items-center sticky top-24">
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                <Smartphone size={15} /> 문제 페이지 실시간 미리보기 (클릭한 문제 표시)
              </p>
              <div
                className="w-[340px] h-[604px] rounded-[36px] border-[8px] border-slate-800 shadow-xl overflow-hidden flex flex-col justify-center p-4 bg-cover bg-center transition-all"
                style={getQuestionBgStyle(activePreviewQ)}
              >
                {activePreviewQ ? (
                  <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-lg text-slate-800">
                    <div className="mb-4">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span style={{ color: quiz.main_color }}>
                          문제 {previewQIdx + 1} / {questions.length}
                        </span>
                        <span className="text-slate-400">
                          {Math.round(((previewQIdx + 1) / questions.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(((previewQIdx + 1) / questions.length) * 100)}%`,
                            backgroundColor: quiz.main_color,
                          }}
                        />
                      </div>
                    </div>

                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 mb-1.5">
                      {activePreviewQ.points}점
                    </span>
                    <h3 className="text-sm font-bold mb-4 leading-snug" style={{ color: quiz.text_color }}>
                      Q{previewQIdx + 1}. {activePreviewQ.question_text || '질문 내용을 입력하세요'}
                    </h3>

                    {activePreviewQ.type === 'multiple' && (
                      <div className="space-y-2 mb-4">
                        {activePreviewQ.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    {activePreviewQ.type === 'ox' && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="py-5 rounded-xl border-2 border-slate-200 text-center text-xl font-extrabold text-slate-600">
                          O
                        </div>
                        <div className="py-5 rounded-xl border-2 border-slate-200 text-center text-xl font-extrabold text-slate-600">
                          X
                        </div>
                      </div>
                    )}

                    {activePreviewQ.type === 'short' && (
                      <div className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-400 mb-4">
                        주관식 답변 입력칸
                      </div>
                    )}

                    <div
                      className="w-full py-2.5 rounded-xl text-white text-xs font-bold text-center"
                      style={{ backgroundColor: quiz.main_color }}
                    >
                      {previewQIdx < questions.length - 1 ? '다음 문제 ▶' : '제출하고 결과 보기 ✓'}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/90 p-6 rounded-2xl text-center text-xs text-slate-500">
                    왼쪽에서 문제를 추가하면 이곳에 미리보기가 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 탭 3: 결과 편집 & 커스텀 미리보기 ==================== */}
        {activeTab === 'results' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="font-bold text-base border-b pb-3">결과 페이지 디자인 & 요소 설정</h3>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">획득 점수 (예: 100 / 100점) 표시</p>
                    <p className="text-[11px] text-slate-500">끄면 점수 숫자 없이 결과 타이틀과 멘트만 노출됩니다.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={quiz.show_score}
                    onChange={(e) => setQuiz({ ...quiz, show_score: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    상단 배지 문구 설정 (비워두면 배지 숨김)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    <code>{'{name}'}</code>을 넣으면 응시자 이름으로 자동 바뀝니다.
                  </p>
                  <input
                    type="text"
                    value={quiz.result_badge_text}
                    onChange={(e) => setQuiz({ ...quiz, result_badge_text: e.target.value })}
                    placeholder="비워두면 배지 숨김 (예: {name}님의 응시 결과)"
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">결과 페이지 배경 스타일</label>
                  <div className="flex gap-2 mb-3">
                    {[
                      { id: 'inherit', label: '메인 배경 동일' },
                      { id: 'color', label: '단색 지정' },
                      { id: 'image', label: '배경 이미지 넣기' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQuiz({ ...quiz, result_bg_type: opt.id as 'inherit' | 'color' | 'image' })}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                          quiz.result_bg_type === opt.id
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'border-slate-300 text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {quiz.result_bg_type === 'color' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={quiz.result_bg_color}
                        onChange={(e) => setQuiz({ ...quiz, result_bg_color: e.target.value })}
                        className="w-12 h-9 rounded cursor-pointer border"
                      />
                      <span className="text-xs font-mono text-slate-600">{quiz.result_bg_color}</span>
                    </div>
                  )}

                  {quiz.result_bg_type === 'image' && (
                    <div className="space-y-2">
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-3.5 cursor-pointer hover:bg-slate-50 text-xs text-slate-600">
                        <Upload size={16} />
                        {uploading ? '업로드 중...' : '결과 페이지 배경 이미지 선택 (9:16 권장)'}
                        <input type="file" accept="image/*" onChange={handleResultImageUpload} className="hidden" />
                      </label>
                      {quiz.result_bg_image_url && (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                          <span className="text-xs text-emerald-700 font-semibold">✓ 결과 배경 이미지 적용됨</span>
                          <button
                            type="button"
                            onClick={() => setQuiz({ ...quiz, result_bg_image_url: '', result_bg_type: 'inherit' })}
                            className="text-xs text-rose-600 hover:underline font-bold flex items-center gap-1"
                          >
                            <Trash2 size={13} /> 이미지 지우기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">결과 타이틀 글씨 색상</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={quiz.result_text_color}
                      onChange={(e) => setQuiz({ ...quiz, result_text_color: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border"
                    />
                    <span className="text-xs font-mono">{quiz.result_text_color}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm">점수 구간별 결과 멘트 설정</h3>
                  <p className="text-xs text-slate-500">구간 카드를 클릭하면 오른쪽에서 미리보기가 바뀝니다.</p>
                </div>
                <button
                  onClick={addTier}
                  className="bg-blue-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Plus size={15} /> 구간 추가
                </button>
              </div>

              {tiers.map((tier, idx) => (
                <div
                  key={idx}
                  onClick={() => setPreviewTierIdx(idx)}
                  className={`bg-white p-5 rounded-2xl border-2 transition shadow-sm space-y-3 cursor-pointer ${
                    previewTierIdx === idx ? 'border-blue-500' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="number"
                        value={tier.min_score}
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[idx].min_score = Number(e.target.value);
                          setTiers(updated);
                        }}
                        className="w-20 border rounded px-2 py-1 text-center"
                      />
                      <span>점 이상 ~</span>
                      <input
                        type="number"
                        value={tier.max_score}
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[idx].max_score = Number(e.target.value);
                          setTiers(updated);
                        }}
                        className="w-20 border rounded px-2 py-1 text-center"
                      />
                      <span>점 이하</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTiers(tiers.filter((_, i) => i !== idx));
                        setPreviewTierIdx(0);
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={tier.title}
                    onChange={(e) => {
                      const updated = [...tiers];
                      updated[idx].title = e.target.value;
                      setTiers(updated);
                    }}
                    placeholder="결과 타이틀 (예: 완벽 통과! 우수 사원입니다)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                  <textarea
                    rows={2}
                    value={tier.message}
                    onChange={(e) => {
                      const updated = [...tiers];
                      updated[idx].message = e.target.value;
                      setTiers(updated);
                    }}
                    placeholder="결과 안내 멘트 (비워두면 깔끔하게 타이틀만 노출됩니다)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="lg:col-span-5 flex flex-col items-center sticky top-24">
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                <Smartphone size={15} /> 결과 페이지 실시간 미리보기
              </p>
              <div
                className="w-[340px] h-[604px] rounded-[36px] border-[8px] border-slate-800 shadow-xl overflow-hidden flex flex-col justify-center p-5 bg-cover bg-center transition-all"
                style={getResultBgStyle()}
              >
                <div className="bg-white/95 backdrop-blur-md p-7 rounded-3xl shadow-lg text-center text-slate-800">
                  {previewBadgeText && (
                    <div
                      className="inline-block px-3.5 py-1 rounded-full text-[11px] font-bold text-white mb-3"
                      style={{ backgroundColor: quiz.main_color }}
                    >
                      {previewBadgeText}
                    </div>
                  )}

                  {quiz.show_score && (
                    <div className="my-3">
                      <span className="text-4xl font-black" style={{ color: quiz.main_color }}>
                        100
                      </span>
                      <span className="text-base font-bold text-slate-400"> / 100점</span>
                    </div>
                  )}

                  <h2 className="text-xl font-extrabold mb-2" style={{ color: quiz.result_text_color }}>
                    {activePreviewTier?.title || '결과 타이틀'}
                  </h2>

                  {activePreviewTier && activePreviewTier.message.trim() !== '' && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-3">
                      {activePreviewTier.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 실행 및 공유 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">🚀 퀴즈 실행 및 링크 공유</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                공유 링크 주소 커스텀 (영문, 숫자, 하이픈 권장)
              </label>
              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                <span className="px-3 text-xs text-slate-500 select-none">/q/</span>
                <input
                  type="text"
                  value={quiz.slug}
                  onChange={(e) => setQuiz({ ...quiz, slug: e.target.value })}
                  className="flex-1 bg-white px-3 py-2 text-sm font-mono focus:outline-none"
                />
                <button
                  onClick={handleSaveAll}
                  className="bg-slate-800 text-white px-3 py-2 text-xs font-semibold hover:bg-slate-900"
                >
                  적용
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-blue-900 truncate">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '복사됨' : '링크 복사'}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <a
                href={`/q/${quiz.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold text-center transition"
              >
                새 창에서 퀴즈 바로 풀기 ▶
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}