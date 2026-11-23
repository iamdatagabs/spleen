# Modelo matemático — SPLEEN v0.1

## 1. Escopo
Modelo compartimental de ordem reduzida para explorar respostas qualitativas da perfusão esplâncnica a perturbações hemodinâmicas. Não é um gêmeo digital individual, não foi calibrado nem validado clinicamente.

São representados quatro leitos arteriais paralelos: estômago, intestino, baço e pâncreas. O retorno portal é aproximado pela soma dos fluxos dos compartimentos intestino, baço e pâncreas.

## 2. Estados e parâmetros
Q_i(t) representa o fluxo arterial regional em L/min. O vetor de estados é x(t) = [Q_estômago, Q_intestino, Q_baço, Q_pâncreas]^T. O fluxo basal total inicial é 1,20 L/min, com frações ilustrativas [0,18; 0,62; 0,13; 0,07]. Não são valores de referência clínica.

Constantes de tempo ilustrativas: tau = [1,8; 2,8; 1,5; 2,2] minutos. Entradas: PAM (mmHg), pressão de pneumoperitônio (mmHg), índice abstrato de suporte vasopressor (0–100) e perda volêmica estimada (0–40%).

## 3. Sistema de EDOs
Para cada compartimento i:

dQ_i/dt = (Q_i,alvo(u) - Q_i) / tau_i

A integração numérica utiliza Euler explícito com dt = 0,05 min:

Q_i[n+1] = Q_i[n] + dt * (Q_i,alvo[n] - Q_i[n]) / tau_i.

## 4. Construção do fluxo-alvo
PAM_ef = max(20, PAM + 0,12 V - 0,45 B)

DeltaP = max(8, PAM_ef - 0,65 P_pneu - 8)

Q_global = max(0,12, 1,20 * (DeltaP/69) * (1 - 0,010 B))

Pesos relativos: w_i = f_i * g_i. Para o intestino, g = max(0,35, 1 - 0,025 P_pneu); para o baço, g = 1 + 0,0005 V; para estômago e pâncreas, g = 1 + 0,0015 V.

Q_i,alvo = Q_global * w_i / soma(w_j).

Todos os coeficientes acima são ilustrativos e não representam relações dose-resposta clínicas validadas. A formulação não resolve explicitamente resistência vascular, pressão venosa, complacência, autorregulação ou circulação colateral.

## 5. Indicadores derivados
Fluxo portal aproximado: Q_portal = Q_intestino + Q_baço + Q_pâncreas.

Componente arterial hepático simplificado: Q_HA = 0,20 * soma(Q_i). Considerando conteúdo arterial de oxigênio assumido CaO2 = 18,5 mL/dL, o indicador exibido é DO2_hepático = (Q_portal + Q_HA) * CaO2 / 10, em mL O2/min. Trata-se de indicador derivado experimental, não de medida fisiológica.

Índice regional = 100 * Q_total / 1,20, relativo ao estado inicial. Não é escore clínico.

## 6. Evolução para EDP e CFD
Uma extensão espacial de transporte de oxigênio poderá utilizar:

partial_t C + div(v C) = div(D grad C) - R(C,M)

C é concentração de oxigênio, v velocidade local, D tensor de difusão efetiva e R consumo metabólico. Serão necessários geometria, condições de contorno, malha, estudo de convergência e dados para parametrização. CFD será um módulo distinto e de maior fidelidade; não está implementado no MVP.

Aprendizado de máquina poderá estimar parâmetros ou padrões de resposta apenas após construção de base de dados curada, com incerteza e validação externa.

## 7. Verificação e validação
1. Testes de positividade e limites dos estados.
2. Teste de normalização: soma dos fluxos-alvo deve ser Q_global.
3. Convergência numérica comparando dt, dt/2 e dt/4.
4. Análise de sensibilidade dos parâmetros e constantes de tempo.
5. Registro de unidade, origem, população, incerteza e versão de cada parâmetro.
6. Calibração e validação independente antes de qualquer tradução clínica.

## 8. Limitações
Sem dados de pacientes, calibração, validação, quantificação de incerteza, feedback entre órgãos, débito cardíaco, retorno venoso, farmacocinética, fases cirúrgicas, temperatura ou equilíbrio ácido-base. Não há solução 3D de Navier–Stokes nem EDP espacial implementada. Nenhuma saída deve orientar conduta clínica.