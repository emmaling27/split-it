import ConvexClientProvider from "@/components/ConvexClientProvider";

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
} 