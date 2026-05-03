import { useResumeStore } from "../../store/useResumeStore";
import type { TabId } from "../../types/index";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "⊞ Overview" },
  { id: "fixes", label: "✦ Actionable Fixes" },
  { id: "recruiter", label: "👤 Recruiter View" },
  { id: "gap", label: "◎ Gap Closer" },
  { id: "progress", label: "↗ Progress" },
];

const disabledBeforeAnalysis = new Set<TabId>(["fixes", "gap"]);

export default function TabNav() {
  const activeTab = useResumeStore((state) => state.activeTab);
  const setActiveTab = useResumeStore((state) => state.setActiveTab);
  const analysisResult = useResumeStore((state) => state.analysisResult);

  const handleTabClick = (tabId: TabId): void => {
    if (!analysisResult && disabledBeforeAnalysis.has(tabId)) {
      return;
    }

    setActiveTab(tabId);
  };

  return (
    <nav className="flex border-b border-gray-200 bg-white px-7">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = !analysisResult && disabledBeforeAnalysis.has(tab.id);

        return (
          <button
            key={tab.id}
            type="button"
            className={[
              "flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-5 py-[14px] text-[13px] font-medium text-gray-400",
              isActive
                ? "border-b-[#6c47ff] font-semibold text-[#6c47ff]"
                : "",
              isDisabled ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
