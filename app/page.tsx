import Link from 'next/link';

export default function Home() {
  return (
    <main className="container py-5">
      <div className="text-center">
        <h1 className="mb-3">Sistema de Estudo para Concursos</h1>
        <p className="lead">Faça login, responda questões e receba correções de redação por IA.</p>
        <div className="d-flex justify-content-center gap-3 mt-4">
          <Link href="/login" className="btn btn-primary">Login</Link>
          <Link href="/cadastro" className="btn btn-outline-primary">Cadastro</Link>
        </div>
      </div>
    </main>
  );
}
