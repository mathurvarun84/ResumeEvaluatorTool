import { getDownloadUrl } from "../../api/client";
import { useResumeStore } from "../../store/useResumeStore";

export default function TopBar() {
  const analysisResult = useResumeStore((state) => state.analysisResult);
  const docxId = useResumeStore((state) => state.docxId);

  const handleDownload = (): void => {
    if (!docxId) {
      return;
    }

    window.open(getDownloadUrl(docxId));
  };

  return (
    <header className="flex items-center justify-between px-8 py-4
      bg-white/80 border-b border-[#e5e7eb] sticky top-0 z-50"
      style={{ backdropFilter: 'blur(12px)',
               boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

      <div className="flex items-center gap-3">
        <div className="w-[42px] h-[42px] rounded-xl flex items-center
          justify-center text-white text-[19px] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                   boxShadow: '0 3px 0 #4338ca, 0 5px 12px rgba(99,102,241,0.3)' }}>
          ✦
        </div>
        <div>
          <div className="text-[16px] font-bold text-[#111827] leading-tight">
            AI Career Intelligence Platform
          </div>
          <div className="text-[11px] font-normal text-[#6b7280] mt-px">
            Powered by Advanced AI
          </div>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={!analysisResult}
        className="rounded-[10px] px-5 py-2.5 text-[13px] font-bold
          border-none cursor-pointer transition-all duration-100
          active:translate-y-[3px]
          bg-[#6366f1] text-white
          disabled:bg-[#f3f4f6] disabled:text-[#9ca3af] disabled:cursor-not-allowed"
        style={analysisResult
          ? { boxShadow: '0 3px 0 #4338ca, 0 5px 12px rgba(99,102,241,0.25)' }
          : { boxShadow: '0 3px 0 #d1d5db' }
        }
      >
        Download Report
      </button>
    </header>
  );
}
