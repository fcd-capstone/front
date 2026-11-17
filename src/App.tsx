import { lazy, Suspense } from "react";
const BackendApp = lazy(() => import("./backend/BackendApp"));
const MockApp = lazy(() => import("./MockApp"));
export default function App() {
  const demo =
    new URLSearchParams(window.location.search).get("mode") === "demo";
  return (
    <Suspense
      fallback={
        <div style={{ padding: 32 }}>FCD 관제 화면을 불러오는 중입니다.</div>
      }
    >
      {demo ? <MockApp /> : <BackendApp />}
    </Suspense>
  );
}
