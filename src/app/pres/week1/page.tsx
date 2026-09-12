import Image from "next/image";

export default function Week1Page() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-4xl">
        <section className="mb-20">
          <h2 className="mb-6 text-3xl font-semibold">
            프로젝트 개발 환경 설정
          </h2>
          <p className="text-lg leading-8 text-neutral-300">
            Next.js를 기반으로 React 프로젝트를 생성
            <br />
            언어 TypeScript
            <br />
            Tailwind css 사용
          </p>
          <p className="text-lg leading-8 text-neutral-300"></p>
        </section>

        <section className="mb-20">
          <h2 className="mb-6 text-3xl font-semibold">페이지 구성</h2>

          <Image
            src="/pres/week1/1.png"
            alt=""
            className="mb-6 h-auto w-100 rounded-2xl"
          />

          <p className="text-lg leading-8 text-neutral-300">
            메인 페이지, 로그인, 회원가입, 대시보드, 프로젝트 페이지
          </p>
        </section>

        <section className="mb-20">
          <h2 className="mb-6 text-3xl font-semibold">작업 화면 구상</h2>

          <Image
            src="/pres/week1/2.png"
            alt=""
            className="mb-6 w-full rounded-2xl"
          />

          <p className="text-lg leading-8 text-neutral-300"></p>
        </section>
      </div>
    </main>
  );
}
