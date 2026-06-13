import { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Sparkles, Mic, RotateCcw, MessageSquare } from 'lucide-react';

type Mode = 'coach' | 'simulate';
interface Message { role: 'ai' | 'user'; content: string; timestamp: string; }

const coachResponses: Record<string, string> = {
  default: '我来帮你分析这个问题。基于你的背景，建议从以下几个维度准备：\n\n1. **STAR结构化回答**：先描述情境(Situation)，再说明任务(Task)，然后阐述行动(Action)，最后量化结果(Result)\n2. **数据驱动**：尽量用具体数字支撑你的成果\n3. **与岗位匹配**：将回答与目标岗位的核心要求对齐',
  star: '让我帮你用STAR框架重写这段经历：\n\n**Situation**: 在[公司]担任[职位]期间，面对[具体挑战]\n**Task**: 需要在[时间]内完成[目标]\n**Action**: 我采取了[具体行动1]、[行动2]、[行动3]\n**Result**: 最终实现了[量化结果]，超出预期[百分比]\n\n建议你将关键数字加粗，面试官对量化结果最敏感。',
  salary: '薪资谈判建议：\n\n1. **市场调研**：目标岗位P50-P75分位在35-50万/年\n2. **锚定策略**：先让对方出价，若需报价则报高15-20%\n3. **价值论证**：准备3个你能带来的具体价值点\n4. **备选方案**：准备BATNA(最佳替代方案)增强谈判底气',
};

const simulateQuestions = [
  '请介绍一下你最有挑战性的项目经历。',
  '你如何处理团队中的技术分歧？',
  '描述一次你主导的系统架构决策，以及它的结果。',
  '你对我们公司的产品有什么了解？你认为可以如何改进？',
];

export default function Coach() {
  const [mode, setMode] = useState<Mode>('coach');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: '你好！我是你的AI职业教练。我可以帮你：\n\n• 用STAR框架重写工作经历\n• 模拟面试并给出实时反馈\n• 薪资谈判策略建议\n• 简历优化与岗位匹配分析\n\n请告诉我你需要什么帮助？', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const getAIResponse = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();
    if (lower.includes('star') || lower.includes('重写') || lower.includes('经历')) return coachResponses.star;
    if (lower.includes('薪') || lower.includes('谈判') || lower.includes('offer')) return coachResponses.salary;
    return coachResponses.default;
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const response = mode === 'simulate'
        ? `**AI面试官评估**：\n\n回答结构性: 7/10\n内容深度: 6/10\n与岗位相关性: 8/10\n\n**改进建议**: 建议增加具体数据支撑，并在结尾强调对目标岗位的价值贡献。\n\n---\n\n下一题：${simulateQuestions[Math.min(simIndex + 1, simulateQuestions.length - 1)]}`
        : getAIResponse(userMsg.content);
      setMessages(prev => [...prev, { role: 'ai', content: response, timestamp: new Date().toLocaleTimeString() }]);
      setIsTyping(false);
      if (mode === 'simulate') setSimIndex(i => Math.min(i + 1, simulateQuestions.length - 1));
    }, 1500);
  };

  const startSimulation = () => {
    setMode('simulate'); setSimIndex(0);
    setMessages([{ role: 'ai', content: `**模拟面试模式已开启**\n\n我将扮演面试官，针对你的目标岗位进行结构化面试。每轮回答后我会给出评分和改进建议。\n\n---\n\n**第1题**: ${simulateQuestions[0]}`, timestamp: new Date().toLocaleTimeString() }]);
  };

  const resetChat = () => {
    setMode('coach'); setSimIndex(0);
    setMessages([{ role: 'ai', content: '已重置对话。有什么我可以帮你的？', timestamp: new Date().toLocaleTimeString() }]);
  };

  return (
    <div className="p-8 h-full flex flex-col max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">AI 职业教练</h1><p className="text-sm text-muted mt-1">Career Coach · STAR重写 / 模拟面试 / 薪资策略</p></div>
        <div className="flex items-center gap-2">
          <button onClick={resetChat} className="btn-ghost"><RotateCcw className="w-4 h-4" />重置</button>
          <button onClick={() => mode === 'coach' ? startSimulation() : setMode('coach')} className={`${mode === 'simulate' ? 'btn-primary' : 'btn-secondary'}`}>
            <Mic className="w-4 h-4" />{mode === 'simulate' ? '退出模拟' : '模拟面试'}
          </button>
        </div>
      </div>

      {mode === 'simulate' && (
        <div className="mb-4 p-3 bg-brand-50 rounded-xl border border-brand-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-xs text-brand-700 font-medium">模拟面试进行中 · 第 {simIndex + 1}/{simulateQuestions.length} 题</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 glass-card p-6 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-brand-100 text-brand-600' : 'bg-ink-200 text-muted'}`}>
              {msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`max-w-[75%] p-4 rounded-2xl ${msg.role === 'ai' ? 'bg-ink-50 border border-border' : 'bg-brand-500 text-white'}`}>
              <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-foreground'}`}
                dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              <p className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-brand-200' : 'text-muted'}`}>{msg.timestamp}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center"><Bot className="w-4 h-4" /></div>
            <div className="bg-ink-50 border border-border rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-ink-300 animate-bounce" /><div className="w-2 h-2 rounded-full bg-ink-300 animate-bounce" style={{ animationDelay: '0.1s' }} /><div className="w-2 h-2 rounded-full bg-ink-300 animate-bounce" style={{ animationDelay: '0.2s' }} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={mode === 'simulate' ? '输入你的面试回答...' : '输入你的问题（如：帮我用STAR重写项目经历）...'}
            className="input-field flex-1" />
          <button onClick={sendMessage} disabled={!input.trim()} className="btn-primary disabled:opacity-50"><Send className="w-4 h-4" />发送</button>
        </div>
        <div className="flex items-center gap-3 mt-2 pl-8">
          <button onClick={() => setInput('帮我用STAR框架重写项目经历')} className="text-[10px] text-brand-600 hover:underline flex items-center gap-1"><MessageSquare className="w-3 h-3" />STAR重写</button>
          <button onClick={() => setInput('薪资谈判策略建议')} className="text-[10px] text-brand-600 hover:underline flex items-center gap-1"><MessageSquare className="w-3 h-3" />薪资谈判</button>
          <button onClick={() => setInput('如何回答"你的缺点是什么"')} className="text-[10px] text-brand-600 hover:underline flex items-center gap-1"><MessageSquare className="w-3 h-3" />常见问题</button>
        </div>
      </div>
    </div>
  );
}
