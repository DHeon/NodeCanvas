import Link from "next/link";

export default function LoginPage() {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen ">
            <div className="flex w-80 flex-col items-start">
                <Link href="/" className="flex h-6 w-16 items-center justify-center rounded-full border border-neutral-300 text-xs hover:bg-neutral-100 mb-3">이전</Link>
                <h1 className="text-2xl pb-4">로그인</h1>
                <form>
                    <input className="rounded-xl block border border-neutral-700 py-2 pl-3 mb-5" type="text" placeholder="아이디 입력" />
                    <input className="rounded-xl block border border-neutral-700 py-2 pl-3 mb-5" 
                    type="password" autoComplete="new-password" placeholder="비밀번호 입력" />

                    <button className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800" type="button">로그인</button>
                </form>

            </div>

        </main>
    );
}