import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Interessado, Setor } from "../domain/types";
import type { InteressadoRepository, SetorRepository } from "../repositories/types";

interface PublicPessoa {
  id: string;
  nome: string;
  cargo: string | null;
  matricula: string | null;
}

interface PublicSetor {
  id: string;
  sigla: string;
  nomeCompleto: string;
}

interface PublicEscalaData {
  pessoas: PublicPessoa[];
  setores: PublicSetor[];
}

const pessoasQuerySchema = z.object({
  q: z.string().trim().optional(),
});

function mapPessoa(pessoa: Interessado): PublicPessoa {
  return {
    id: pessoa.id,
    nome: pessoa.nome,
    cargo: pessoa.cargo,
    matricula: pessoa.matricula,
  };
}

function mapSetor(setor: Setor): PublicSetor {
  return {
    id: setor.id,
    sigla: setor.sigla,
    nomeCompleto: setor.nomeCompleto,
  };
}

async function loadEscalaPublicData(
  interessadoRepository: InteressadoRepository,
  setorRepository: SetorRepository,
  q?: string,
): Promise<PublicEscalaData> {
  const [pessoasResult, setores] = await Promise.all([
    interessadoRepository.list({
      q,
      page: 1,
      pageSize: 1000,
    }),
    setorRepository.list(),
  ]);

  return {
    pessoas: pessoasResult.items.map(mapPessoa),
    setores: setores.map(mapSetor),
  };
}

export async function registerEscalaPlantaoRoutes(
  app: FastifyInstance,
  options: { interessadoRepository: InteressadoRepository; setorRepository: SetorRepository },
) {
  const { interessadoRepository, setorRepository } = options;

  app.get("/api/public/escala/dados", async (request, reply) => {
    const query = pessoasQuerySchema.parse(request.query);
    const data = await loadEscalaPublicData(interessadoRepository, setorRepository, query.q);

    return reply.send({
      ok: true,
      data,
      error: null,
    });
  });

  app.get("/api/public/escala/pessoas", async (request, reply) => {
    const query = pessoasQuerySchema.parse(request.query);
    const data = await loadEscalaPublicData(interessadoRepository, setorRepository, query.q);

    return reply.send({
      ok: true,
      data: data.pessoas,
      error: null,
    });
  });

  app.get("/api/public/escala/setores", async (_request, reply) => {
    const data = await loadEscalaPublicData(interessadoRepository, setorRepository);

    return reply.send({
      ok: true,
      data: data.setores,
      error: null,
    });
  });
}
