# Modelo matemático — SPLEEN v0.2

## 1. Escopo
Modelo compartimental de ordem reduzida para explorar respostas qualitativas da perfusão esplâncnica e da dinâmica portal-hepática. Não é um gêmeo digital individual, não foi calibrado nem validado clinicamente.

São representados quatro leitos arteriais: estômago, intestino, baço e pâncreas. Os fluxos dos territórios intestino, baço e pâncreas alimentam o compartimento portal. A drenagem portal-hepática é representada por uma resistência e a pressão portal por um compartimento complacente.

## 2. Estados e parâmetros
Estados:
- Q_i(t): fluxo arterial regional do órgão i, em L/min.
- P_p(t): pressão portal, em mmHg.

Vetor regional inicial: [0,216; 0,744; 0,156; 0,084] L/min. Frações basais ilustrativas: [0,18; 0,62; 0,13; 0,07]. Constantes de tempo regionais: tau = [1,8; 2,8; 1,5; 2,2] min.

Parâmetros adicionais ilustrativos:
- Complacência portal C_p = 0,08 L/mmHg.
- Pressão venosa hepática P_hv = 5 mmHg.
- Resistência efetiva de drenagem R_h = 5/0,984 mmHg/(L/min), escolhida para equilíbrio basal aproximado.
- Conteúdo arterial de oxigênio CaO2 = 18,5 mL/dL.

Entradas: PAM (mmHg), pressão de pneumoperitônio (mmHg), índice abstrato de suporte vasopressor (0–100) e perda volêmica estimada (0–40%).

## 3. Sistema acoplado de EDOs

Para cada leito arterial regional:

dQ_i/dt = (Q_i,alvo(PAM, P_pneu, V, B, P_p) - Q_i) / tau_i

Balanço portal:

C_p dP_p/dt = Q_p,entrada - Q_p,saída

Q_p,entrada = Q_intestino + Q_baço + Q_pâncreas

Q_p,saída = max(0, (P_p - P_hv) / R_h)

A pressão portal retroage sobre o fluxo-alvo regional por um fator simplificado:

f_p = max(0,65, 1 - 0,018(P_p - 10))

A perfusão regional efetiva também depende de um gradiente simplificado entre pressão arterial efetiva e pressão venosa/abdominal. Os pesos regionais preservam a distribuição basal modificada por fatores ilustrativos de pneumoperitônio e suporte vasopressor.

## 4. Integração numérica
O protótipo usa Euler explícito, com passo padrão dt = 0,025 min. A implementação Python e a implementação JavaScript seguem o mesmo sistema. Devem ser comparados passos dt, dt/2 e dt/4 para verificar convergência; a positividade dos fluxos e a estabilidade da pressão portal devem ser testadas em todo o domínio de entradas.

## 5. Indicadores derivados
- Fluxo portal de entrada: soma dos fluxos intestino, baço e pâncreas.
- Saída portal-hepática: gradiente portal-hepático dividido pela resistência efetiva.
- Fluxo arterial hepático: componente de 20% do fluxo total, modulado por uma resposta tampão portal-hepática simplificada.
- Entrega hepática de O2: (Q_p,saída + Q_HA) × 185, em mL O2/min.

A conversão 185 resulta de 18,5 mL/dL × 10 dL/L. O fluxo portal de entrada não deve ser confundido com a saída portal-hepática. Todos os indicadores são resultados do modelo, não medidas clínicas.

## 6. Hipóteses e limitações
Não há autorregulação regional baseada em mecanismos fisiológicos validados, resistência individual por órgão, curva pressão-fluxo empírica, controle neural/hormonal, débito cardíaco, retorno venoso, farmacocinética, temperatura, equilíbrio ácido-base, fluxo colateral ou heterogeneidade microvascular. A resposta tampão arterial hepática é uma hipótese algébrica simplificada, não uma representação validada do hepatic arterial buffer response.

Os valores de complacência, resistência e coeficientes de retroalimentação são demonstrativos e escolhidos para estabilidade/ilustração. Não devem ser interpretados como valores fisiológicos de referência.

## 7. Evolução para EDP e CFD
Uma extensão espacial de transporte de oxigênio poderá utilizar:

partial_t C + div(v C) = div(D grad C) - R(C,M)

C é concentração de oxigênio, v velocidade local, D tensor de difusão efetiva e R consumo metabólico. Serão necessários geometria, condições de contorno, malha, estudo de convergência e dados para parametrização. CFD será um módulo distinto e de maior fidelidade; não está implementado no MVP.

## 8. Verificação e validação
1. Testes de positividade e limites dos estados.
2. Equilíbrio basal: Q_p,entrada aproximadamente igual a Q_p,saída.
3. Convergência numérica comparando dt, dt/2 e dt/4.
4. Testes de conservação do balanço portal.
5. Análise de sensibilidade de C_p, R_h e coeficientes de feedback.
6. Registro de unidade, origem, população, incerteza e versão de cada parâmetro.
7. Calibração e validação independente antes de qualquer tradução clínica.

## 9. Segurança
Nenhuma saída deve orientar conduta clínica, diagnóstico, prescrição ou decisão intraoperatória. O sistema é exclusivamente experimental e educacional.

## 10. Análise local de sensibilidade — v0.3.0
A API disponibiliza `POST /api/v1/sensitivity`. O endpoint executa análise one-at-a-time (OAT), mantendo o cenário hemodinâmico fixo e perturbando individualmente quatro parâmetros estruturais em ±10%:
- complacência portal (C_p);
- resistência efetiva de drenagem hepática (R_h);
- ganho de retroalimentação portal;
- escala das constantes de tempo regionais (tau_scale).

Para cada perturbação são retornados os valores basal, baixo e alto para fluxo esplâncnico total, pressão portal, saída portal-hepática e entrega hepática de oxigênio. Também é calculada a elasticidade normalizada local:
`E = (dY/dp) × (p/Y)`.
A variação percentual entre os extremos é fornecida como descrição da resposta à faixa testada; não é intervalo de confiança.

Esta é uma análise local exploratória, dependente do cenário basal e da amplitude arbitrada. Não captura interações entre parâmetros nem distribuições probabilísticas. A próxima etapa metodológica é Latin Hypercube Sampling ou Monte Carlo, após definir distribuições justificadas por literatura/dados. O endpoint não substitui calibração ou validação.


## 11. Análise global de incerteza e inferência — v0.4.0

A plataforma inclui três rotas de análise, implementadas no backend Python e na interface estática por execução local no navegador.

### 11.1 Latin Hypercube Sampling (LHS)
Cada parâmetro tem seu intervalo dividido em N estratos equiprováveis; uma amostra é sorteada em cada estrato e as colunas são permutadas independentemente. A análise é prior-preditiva: os resultados descrevem a propagação das distribuições assumidas, sem condicionar a dados observados.

### 11.2 Monte Carlo
São sorteados N vetores independentes a partir de distribuições uniformes nos intervalos definidos. A comparação com LHS deve considerar erro de Monte Carlo, estabilidade dos quantis e cobertura do espaço amostral.

### 11.3 Markov Chain Monte Carlo (MCMC) — v0.5.0
Foi implementado um amostrador exploratório Random-Walk Metropolis com quatro cadeias independentes por padrão (configurável entre 2 e 8 na API). As cadeias usam sementes distintas e inicializações dispersas no espaço a priori. O usuário fornece observações no formato:
```json
[
  {"metric": "portal_pressure_mmhg", "value": 10.0, "sd": 1.0}
]
```
A função de verossimilhança é Gaussiana independente:
`log L = -1/2 Σ[((y_model - y_obs)/sd)^2] - Σ log(sd)`.
Os priors são uniformes e limitados aos intervalos paramétricos. A cadeia é inicializada no ponto médio de cada intervalo. O usuário define burn-in, thinning e número de amostras retidas.

A resposta inclui amostras por cadeia, taxas de aceitação individuais, R-hat dividido (split-R-hat), ESS aproximado por sequência positiva inicial e autocorrelação de defasagem 1. O painel browser apresenta sumários diagnósticos; o backend retorna também as séries de cada cadeia. O status exploratório usa R-hat < 1,05 e ESS ≥ 100 como limiares operacionais, não como garantia de convergência. As estimativas de ESS são aproximações e não substituem ferramentas especializadas de diagnóstico. O backend expõe `POST /api/v1/mcmc`; LHS e Monte Carlo usam `POST /api/v1/uncertainty` com `method` igual a `lhs` ou `monte_carlo`.

### 11.4 Intervalos e distribuições exploratórias
Os intervalos atualmente usados são hipóteses computacionais para explorar comportamento:
- C_p: 0,01–0,30 L/mmHg;
- R_h: 2–12 mmHg/(L/min);
- ganho de feedback portal: 0,002–0,05;
- escala de tau: 0,5–2,0.

Essas faixas não são estimativas populacionais nem priors fundamentados em evidência. Devem ser substituídas ou justificadas por literatura, experimentos ou dados rastreáveis. P05/P50/P95 representam quantis da distribuição preditiva ou posterior do modelo, não intervalos de confiança clínicos.

### 11.5 Limitações e plano de validação
O modelo permanece reduzido e não calibrado. Não existe dataset clínico associado ao protótipo. Não se deve tratar dados sintéticos, cenários de demonstração ou valores inseridos pelo usuário como observações clínicas. O MCMC só é informativo em relação à qualidade, independência e incerteza das observações fornecidas e à adequação da verossimilhança. Próximos passos: múltiplas cadeias, diagnósticos, testes de recuperação de parâmetros em dados sintéticos, análise de identificabilidade e validação externa.


### 11.6 Verificação sintética de recuperação — v0.5.0

A suíte automatizada gera saídas sintéticas a partir de um vetor paramétrico conhecido e verifica se o vetor gerador apresenta discrepância nula em relação às próprias saídas, enquanto uma alternativa perturbada apresenta discrepância maior. Este teste verifica consistência do caminho direto e da comparação paramétrica. Como os dados são gerados pelo próprio modelo, não constitui validação independente, demonstração de identificabilidade, nem evidência de que os parâmetros sejam recuperáveis em dados reais.

A recuperação inferencial deve ser aprofundada com experimentos de simulação-estimação (simulation-based calibration), diferentes níveis de ruído, desenho de observações, análise de correlação posterior e avaliação de identificabilidade estrutural/prática. O resultado de convergência MCMC não resolve esses problemas.


## 12. Especificação matemática em LaTeX — v0.6.0

A formulação formal completa está disponível em [`docs/model.tex`](model.tex). O documento apresenta estados, unidades, entradas, gradiente de perfusão, fluxo-alvo regional, EDOs acopladas, indicadores derivados e esquema de Euler explícito. As equações correspondem à estrutura reduzida implementada no protótipo; as relações fenomenológicas e os coeficientes permanecem hipóteses exploratórias.

## 13. Investigações metodológicas — v0.6.0

### 13.1 Triagem de identificabilidade local

O endpoint `POST /api/v1/identifiability` calcula uma matriz de sensibilidades finitas e escaladas, posto numérico e cossenos entre colunas paramétricas. A análise avalia se os efeitos dos parâmetros são distinguíveis localmente para os quatro indicadores finais e no cenário escolhido. Posto deficiente ou colunas quase colineares sugerem problemas de identificabilidade prática. Posto completo não prova identificabilidade estrutural ou global.

### 13.2 Sensibilidade às hipóteses de prior

O endpoint `POST /api/v1/prior-sensitivity` compara cenários uniformes contraído, de referência e expandido. Retorna quantis preditivos e deslocamentos relativos de P05/P50/P95. O exercício mede dependência das conclusões em relação aos limites arbitrados; não transforma os intervalos em priors empiricamente fundamentados.

### 13.3 Recuperação sintética e ranks

O endpoint `POST /api/v1/synthetic-recovery` gera parâmetros verdadeiros a partir dos intervalos exploratórios, produz observações sintéticas com ruído Gaussiano e aproxima a distribuição posterior por amostragem por importância de candidatos do prior. Retorna ranks normalizados, erro absoluto mediano normalizado e ESS da amostragem por importância. Trata-se de uma verificação preliminar estilo SBC, não de uma implementação formal validada de Simulation-Based Calibration. ESS baixo indica degeneração da aproximação posterior; nesse caso, os ranks e erros não devem ser interpretados como diagnóstico confiável.

Os três endpoints usam dados inteiramente sintéticos/modelados e não fornecem evidência fisiológica. São ferramentas para detectar fragilidades matemáticas, dependência de hipóteses e limitações de informação no modelo atual.
