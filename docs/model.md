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
