export default function LoginLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy>
      <div className="mx-auto w-full max-w-md">
        <span className="sr-only">불러오는 중이에요</span>
        <div className="h-8 w-52 rounded-lg shimmer" />
        <div className="mt-2 h-5 w-full rounded-lg shimmer" />
        <div className="mt-6 h-12 rounded-xl shimmer" />
        <div className="mt-6 flex flex-col gap-4">
          <div className="h-12 rounded-xl shimmer" />
          <div className="h-12 rounded-xl shimmer" />
          <div className="h-12 rounded-xl shimmer" />
        </div>
      </div>
    </main>
  );
}
