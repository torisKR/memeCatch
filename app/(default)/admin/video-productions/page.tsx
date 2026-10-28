import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { VideoProductionConsole } from "@/components/admin/video-production-console";
import { getVideoProductionWorkspace } from "@/lib/video-production/workspace.server";

export const metadata = {
  title: "영상 제작·발행",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VideoProductionsPage() {
  await requireOperatorPage("/admin/video-productions");
  const workspace = await getVideoProductionWorkspace();
  return <VideoProductionConsole workspace={workspace} />;
}
