import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-700">Lumen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa con tu correo y contraseña
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
