import ConvexClientProvider from "@/components/ConvexClientProvider";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
} 