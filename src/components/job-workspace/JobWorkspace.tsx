"use client";

import { useMemo, useState } from "react";
import { countIncompleteTasks } from "@/lib/job-folder";
import { JobSidebar, type SectionCounts } from "@/components/job-workspace/JobSidebar";
import { JobHeaderBar, type HeaderJob } from "@/components/job-workspace/JobHeaderBar";
import {
  JobSectionContent,
  isDailyReport,
  type FileItem,
  type JobSection,
  type NoteItem,
  type TaskItem,
} from "@/components/job-workspace/JobSectionContent";

type Props = {
  job: HeaderJob;
  isAdmin: boolean;
  notes: NoteItem[];
  files: FileItem[];
  tasks: TaskItem[];
};

export function JobWorkspace({ job, isAdmin, notes, files, tasks }: Props) {
  const [activeSection, setActiveSection] = useState<JobSection>("FEED");
  const [railExpanded, setRailExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const counts = useMemo<SectionCounts>(() => ({
    FILES: files.filter((file) => file.type === "DOCUMENT").length,
    PHOTOS: files.filter((file) => file.type === "PHOTO").length,
    DAILY_REPORTS: notes.filter(isDailyReport).length,
    TASKS: countIncompleteTasks(tasks),
  }), [files, notes, tasks]);

  return (
    <div className="flex animate-in fade-in duration-300">
      <JobSidebar
        activeSection={activeSection}
        counts={counts}
        onSelect={setActiveSection}
        expanded={railExpanded}
        onToggleExpanded={() => setRailExpanded((current) => !current)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="min-w-0 flex-1">
        <JobHeaderBar job={job} isAdmin={isAdmin} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <JobSectionContent
          activeSection={activeSection}
          notes={notes}
          files={files}
          tasks={tasks}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
