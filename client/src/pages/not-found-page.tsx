import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-xl">
        <CardContent className="grid gap-4 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-600">Erro 404</p>
          <h1 className='font-["IBM_Plex_Serif",Georgia,serif] text-3xl text-slate-950'>Pagina nao encontrada</h1>
          <p className="text-sm text-slate-500">A rota solicitada nao existe nesta interface do Gestor Web.</p>
          <div className="flex justify-center">
            <Button asChild>
              <Link to="/dashboard">Voltar ao dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
