// Показывается сразу при переходе между разделами, пока сервер готовит страницу.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="skel h-7 w-48" />
      <div className="skel h-4 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="skel h-24" />
        <div className="skel h-24" />
        <div className="skel h-24" />
      </div>
      <div className="skel h-64" />
    </div>
  );
}
