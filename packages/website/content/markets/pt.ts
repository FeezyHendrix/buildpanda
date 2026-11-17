import type { MarketGuides } from "./types";

export const pt: MarketGuides = {
  NG: {
    description: "Escolher software de gestão de obras na Nigéria: mapas de quantidades, preços revistos, provas de execução e registos de pagamento.",
    intro: "Avalie o software num projeto nigeriano real, do mapa de quantidades orçamentado à entrega. O empreiteiro, o medidor orçamentista e o dono da obra à distância precisam de um registo comum, com permissões distintas para consultar custos, comunicar trabalhos e aprovar alterações.",
    sections: [
      { heading: "Preservar o orçamento inicial quando os preços mudam", body: "Comece pelo seu mapa de quantidades, pelas datas das propostas dos fornecedores e pelos preços contratuais. Teste uma proposta revista sem substituir o orçamento aceite. Em contratação pública, consulte os documentos de concurso revistos do BPP e use o contrato do projeto como referência para o circuito de aprovação." },
      { heading: "Ligar as provas da obra ao relatório do proprietário", body: "Num exemplo de edifício em Lagos, acompanhe uma entrega até ao stock, ao diário de obra e à inspeção. Peça depois ao proprietário para consultar o progresso sem aceder aos preços confidenciais do empreiteiro. Cada fotografia deve identificar o trabalho e a data; cada pagamento registado deve indicar o que foi certificado." },
    ],
    pilot: "Traga um desenho, dez linhas do mapa de quantidades, uma proposta revista de materiais e um certificado de pagamento. Siga uma alteração até à sua aprovação e teste um registo sem ligação antes de sincronizar.",
  },
  GH: {
    description: "Comparar software de obras no Gana com documentos de concurso, medições, entregas e um teste prático de entrega do projeto.",
    intro: "Para um empreiteiro ganês, um ensaio útil começa pelos documentos que a equipa já utiliza. Ligue o âmbito contratado, as quantidades medidas e os registos da obra para que uma instrução revista não se transforme numa diferença de orçamento sem explicação.",
    sections: [
      { heading: "Adaptar o registo ao lote de trabalhos", body: "A PPA do Gana publica diferentes documentos normalizados para contratação de obras. Quando se tratar de um concurso público, comece pelo documento emitido para esse projeto. Verifique se o âmbito inicial, o mapa de quantidades aceite e as instruções posteriores permanecem identificáveis, sem tratar cada ficheiro carregado como o acordo em vigor." },
      { heading: "Conferir as entregas antes de certificar os trabalhos", body: "Num exemplo em Acra, registe uma encomenda, uma entrega parcial e o saldo esperado. Peça ao responsável de obra e ao medidor para conferirem as mesmas quantidades. Separe os materiais recebidos dos trabalhos executados: uma guia de entrega não demonstra que uma atividade de construção está concluída." },
    ],
    pilot: "Use um lote de trabalhos, uma guia de entrega com falta de material e uma medição intercalar. Acompanhe a resolução da diferença e confirme que o cliente pode consultar a medição sem a poder alterar.",
  },
  KE: {
    description: "Software de construção no Quénia: avaliar documentos do projeto, revisões de desenhos e acompanhamento das inspeções.",
    intro: "Um projeto queniano precisa de mais do que um quadro de tarefas. Avalie como o sistema relaciona desenhos aprovados, documentos dos intervenientes e trabalhos comunicados em obra, preservando quem emitiu cada revisão e quem aceitou os trabalhos.",
    sections: [
      { heading: "Preparar um dossier de projeto rastreável", body: "A lista de registo de projetos da NCA refere desenhos, documentos dos profissionais e empreiteiros, um resumo do mapa de quantidades e acordos do projeto. Use a lista oficial atual para preparar o dossier. Organizar um ficheiro no software é diferente de obter o registo ou uma aprovação da autoridade." },
      { heading: "Associar cada inspeção à revisão do desenho", body: "Num exemplo de edifício de apartamentos em Nairobi, emita um desenho estrutural revisto depois de registar uma inspeção. Verifique se a inspeção original continua associada à revisão examinada e se a equipa identifica a nova instrução. Um defeito por resolver deve manter o responsável e o histórico de acompanhamento." },
    ],
    pilot: "Traga um desenho aprovado, a sua substituição e uma inspeção com um defeito. Peça ao inspetor e ao subempreiteiro para resolverem o problema com provas, mantendo visíveis a decisão original e a revisão correspondente.",
  },
  ZA: {
    description: "Avaliar software de obras na África do Sul: subempreitadas, certificados e um histórico de projetos fácil de consultar.",
    intro: "Para uma equipa sul-africana, o software deve facilitar a consulta das decisões de hoje e do dossier final da obra. Teste o percurso desde a adjudicação até à conclusão, sem avaliar o sistema apenas pelo painel de controlo.",
    sections: [
      { heading: "Guardar provas do historial do empreiteiro", body: "A orientação do cidb sobre classificação identifica documentos de adjudicação, conclusão e pagamento entre os comprovativos considerados. Use essa orientação para planear o arquivo e teste a recuperação das provas de um projeto concluído. O armazenamento documental não atribui, por si só, uma classificação nem verifica o registo do empreiteiro." },
      { heading: "Separar o progresso da subempreitada do pagamento", body: "Num exemplo de reabilitação em Joanesburgo, meça uma subempreitada, registe um defeito e prepare uma medição de progresso. O defeito pendente, o montante certificado e o pagamento registado devem permanecer distintos. É o contrato que determina o efeito desses registos no pagamento, não uma percentagem no painel." },
    ],
    pilot: "Traga uma adjudicação de subempreitada, um certificado de progresso e um comprovativo de conclusão. Recupere-os num único historial e verifique que o subempreiteiro não vê os dados comerciais dos outros lotes.",
  },
  MA: {
    description: "Software de gestão de obras em Marrocos: concursos, documentos multilingues, instruções de desenho e relatórios de obra.",
    intro: "Ao avaliar software para um projeto marroquino, acompanhe os documentos originais do concurso até à execução. Defina a língua de trabalho e a identificação dos documentos antes do ensaio, sobretudo quando o proprietário e a equipa usam línguas diferentes.",
    sections: [
      { heading: "Separar a submissão oficial do dossier de execução", body: "O Portal Marroquino dos Contratos Públicos publica o seu próprio guia de utilização. Quando esse portal se aplicar ao concurso, guarde os documentos emitidos e as provas de submissão com o contrato. Um espaço de gestão de obras apoia o historial de execução; não substitui o sistema oficial de contratação pública." },
      { heading: "Testar os documentos reais da equipa", body: "Use um exemplo de acabamentos em Casablanca com documentos em francês ou árabe, uma especificação revista e uma inspeção. Verifique a legibilidade, as referências e as exportações na demonstração. Uma página comercial traduzida não significa que todos os ecrãs do produto, exportações ou modelos contratuais estejam disponíveis nessa língua." },
    ],
    pilot: "Traga uma especificação na língua original, um desenho revisto e uma instrução ao empreiteiro. Peça à equipa para identificar a versão atual e produzir um relatório de inspeção legível pelo proprietário sem perder as referências originais.",
  },
  CM: {
    description: "Comparar software de obras nos Camarões: referências do concurso, lotes, comprovativos de fornecedores e documentos bilingues.",
    intro: "Para uma equipa camaronesa, comece a avaliação por um lote de trabalhos bem definido. Relacione a referência do concurso, as instruções da obra e o progresso medido para que cada relatório possa ser associado ao lote que descreve.",
    sections: [
      { heading: "Preservar a referência do concurso público", body: "A ARMP publica avisos de contratação pública e informação relacionada. Numa obra pública, guarde o aviso relevante e os documentos emitidos com o contrato. Verifique se as instruções posteriores mantêm a referência do lote: um aviso, uma adjudicação e uma instrução são registos diferentes." },
      { heading: "Conferir os relatórios da equipa de execução", body: "Num exemplo de obra em Douala, use documentos originais em inglês e francês. Peça ao supervisor para relacionar uma entrega, um relatório diário e uma quantidade medida com o mesmo lote. Teste designações, unidades e exportações antes de concluir que o produto responde às necessidades linguísticas da equipa." },
    ],
    pilot: "Traga a descrição de um lote, uma guia de entrega e uma instrução revista. Produza um relatório de progresso com provas e verifique que o revisor só pode aprovar os registos que lhe foram atribuídos.",
  },
};
