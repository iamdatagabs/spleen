# Requisitos — SPLEEN

## Objetivo
Oferecer um ambiente reproduzível para explorar efeitos qualitativos de perturbações perioperatórias na distribuição regional do fluxo esplâncnico.

## Requisitos funcionais
- RF-01: ajustar PAM, pneumoperitônio, índice de suporte vasopressor, perda volêmica e duração.
- RF-02: executar o modelo ODE compartimental localmente no navegador.
- RF-03: exibir fluxo esplâncnico total, aproximação do fluxo portal, indicador derivado de entrega hepática de O2 e índice relativo ao basal.
- RF-04: visualizar séries temporais de estômago, intestino, baço e pâncreas.
- RF-05: exibir fluxos regionais e exportar série temporal CSV.
- RF-06: restaurar cenário basal.
- RF-07: documentar equações, hipóteses, unidades e limitações.
- RF-08: separar cálculo do modelo e renderização da interface.

## Requisitos não funcionais
- RNF-01: compatibilidade com GitHub Pages.
- RNF-02: sem API externa ou dependência paga.
- RNF-03: interface responsiva.
- RNF-04: resultado determinístico para mesmas entradas e versão.
- RNF-05: identificar todas as saídas como estimativas.
- RNF-06: separar explicitamente simulação experimental de uso clínico.
- RNF-07: versionar modelo e proveniência dos parâmetros.

## Histórias de usuário
- Pesquisador: perturbar entradas hemodinâmicas e comparar trajetórias regionais.
- Orientador: inspecionar as hipóteses e equações.
- Desenvolvedor: substituir o motor local por API versionada.
- Estudante: exportar séries temporais e analisá-las independentemente.

## Critérios de aceite v0.1
Todos os controles atualizam seus valores; executar atualiza métricas, gráfico e compartimentos; restaurar retorna ao cenário basal; CSV contém tempo e quatro fluxos; a página funciona sem backend; o aviso experimental permanece visível.

## Contrato futuro de API
POST /api/v1/simulations. Entrada: model_version, parameters, duration_min, dt_min e scenario_id opcional. Saída: simulation_id, model_version, time_min, fluxos regionais, fluxo portal, indicador de entrega hepática de oxigênio, hipóteses e avisos. A API deverá validar unidades e limites, registrar versão e proveniência dos parâmetros. A versão GitHub Pages atual não chama essa API.

## Requisitos espaciais — v1.1 preview
- RF-09: atualizar separadamente os ramos arteriais e venosos com os fluxos territoriais simulados.
- RF-10: exibir marcadores e legenda de pressão territorial relativa à referência computacional.
- RF-11: manter leituras numéricas de fluxo arterial, fluxo venoso e pressão local sincronizadas ao último estado simulado.
- RNF-08: manter a transformação visual desacoplada das equações e impedir que escalas gráficas sejam interpretadas como medidas anatômicas ou clínicas.


## Requisitos espaciais e de oxigênio — v1.2
- RF-12: calcular entrega convectiva regional de O₂ por território a partir de fluxo arterial e conteúdo arterial de oxigênio declarado.
- RF-13: exibir entrega regional em mL O₂/min e índice relativo à referência computacional.
- RF-14: atualizar a coloração dos territórios 3D com base na entrega relativa de O₂, combinada à camada de pressão.
- RNF-09: declarar unidades, valores de referência e limites da inferência; não representar entrega de O₂ como oxigenação tecidual ou consumo metabólico.
- RNF-10: testar proporcionalidade, ordenação, interpolação espacial e rejeição de entradas inválidas.
