import clsx from "clsx";

export type TabItem = {
  label: string;
  value: string;
  dot?: boolean;
  render?: React.ReactNode;
};

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (value: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
}

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
  tabClassName,
  activeTabClassName,
}: TabsProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-lg border border-zinc-100 bg-zinc-50 p-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer",
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
              tabClassName,
              isActive && activeTabClassName
            )}
          >
            {tab.render ? (
              tab.render
            ) : (
              <>
                <span>{tab.label}</span>

                {tab.dot && (
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}