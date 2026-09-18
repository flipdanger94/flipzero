import FlipZeroApp from "@/components/flipzero-app";

export default async function ChannelPage({ params }: { params: Promise<{ spaceId: string; channelId?: string[] }> }) {
  const { spaceId, channelId } = await params;
  return <FlipZeroApp initialSpaceId={spaceId} initialChannelId={channelId?.[0]} />;
}
