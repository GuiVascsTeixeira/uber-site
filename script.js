const formulario = document.getElementById("form-cep");
const campoCep = document.getElementById("cep");
const botao = document.getElementById("botao");
const mensagem = document.getElementById("mensagem");
const resultado = document.getElementById("resultado");

// Origem: Uninassau Parangaba (Rua Germano Franck, 613)
const BUSCAS_ORIGEM = [
  "Rua Germano Franck 613, Parangaba, Fortaleza, CE, Brasil",
  "Rua Germano Franck, Parangaba, Fortaleza, CE, Brasil"
];

// Preço fictício da corrida
const TAXA_INICIAL = 4.0;
const PRECO_POR_KM = 1.9;
const TAXA_SERVICO = 1.5;
const PRECO_MINIMO = 7.0;

// A linha reta é menor que o caminho real pelas ruas, por isso multiplicamos por 1,3
const FATOR_RUAS = 1.3;
const VELOCIDADE_MEDIA_KMH = 25;

function mostrarMensagem(texto, ehErro) {
  mensagem.textContent = texto;
  mensagem.className = ehErro ? "mensagem erro" : "mensagem";
}

// Formata o CEP enquanto a pessoa digita: 60744-390
campoCep.addEventListener("input", function () {
  let numeros = campoCep.value.replace(/\D/g, "").slice(0, 8);
  if (numeros.length > 5) {
    numeros = numeros.slice(0, 5) + "-" + numeros.slice(5);
  }
  campoCep.value = numeros;
});

// API 1: ViaCEP valida o CEP e devolve o endereço
async function buscarEndereco(cep) {
  const resposta = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
  if (!resposta.ok) {
    throw new Error("Não foi possível consultar o CEP agora.");
  }
  const dados = await resposta.json();
  if (dados.erro) {
    throw new Error("CEP não encontrado. Confira os números e tente de novo.");
  }
  return dados;
}

// API 2: Nominatim transforma um endereço em latitude e longitude
async function buscarCoordenadas(consulta) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(consulta);
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error("Não foi possível localizar o endereço no mapa.");
  }
  const lista = await resposta.json();
  if (lista.length === 0) {
    return null;
  }
  return { lat: Number(lista[0].lat), lon: Number(lista[0].lon) };
}

// Tenta cada busca da lista até uma funcionar
async function coordenadasComTentativas(buscas) {
  for (let i = 0; i < buscas.length; i++) {
    const coordenadas = await buscarCoordenadas(buscas[i]);
    if (coordenadas) {
      return { coordenadas: coordenadas, aproximada: i > 0 };
    }
  }
  return null;
}

// Fórmula de Haversine: distância em km entre dois pontos da Terra
function calcularDistanciaKm(a, b) {
  const raioTerra = 6371;
  const paraRadianos = (graus) => graus * Math.PI / 180;

  const dLat = paraRadianos(b.lat - a.lat);
  const dLon = paraRadianos(b.lon - a.lon);

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(a.lat)) * Math.cos(paraRadianos(b.lat)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * raioTerra * Math.asin(Math.sqrt(h));
}

function calcularPreco(distanciaKm) {
  const total = TAXA_INICIAL + distanciaKm * PRECO_POR_KM + TAXA_SERVICO;
  return Math.max(total, PRECO_MINIMO);
}

function formatarDinheiro(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

formulario.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const cep = campoCep.value.replace(/\D/g, "");
  resultado.hidden = true;

  if (cep.length !== 8) {
    mostrarMensagem("Digite um CEP com 8 números.", true);
    return;
  }

  botao.disabled = true;
  mostrarMensagem("Buscando endereço e calculando...", false);

  try {
    const endereco = await buscarEndereco(cep);

    const buscasDestino = [
      endereco.logradouro + ", " + endereco.bairro + ", " + endereco.localidade + ", " + endereco.uf + ", Brasil",
      endereco.bairro + ", " + endereco.localidade + ", " + endereco.uf + ", Brasil",
      endereco.localidade + ", " + endereco.uf + ", Brasil"
    ];

    const origem = await coordenadasComTentativas(BUSCAS_ORIGEM);
    const destino = await coordenadasComTentativas(buscasDestino);

    if (!origem || !destino) {
      throw new Error("Não consegui localizar esse endereço no mapa.");
    }

    const linhaReta = calcularDistanciaKm(origem.coordenadas, destino.coordenadas);
    const distanciaKm = linhaReta * FATOR_RUAS;
    const minutos = Math.max(Math.round(distanciaKm / VELOCIDADE_MEDIA_KMH * 60), 1);
    const preco = calcularPreco(distanciaKm);

    const partesEndereco = [endereco.logradouro, endereco.bairro, endereco.localidade + " - " + endereco.uf];
    document.getElementById("destino").textContent =
      partesEndereco.filter(Boolean).join(", ") + " (CEP " + endereco.cep + ")";
    document.getElementById("distancia").textContent =
      distanciaKm.toFixed(1).replace(".", ",") + " km";
    document.getElementById("tempo").textContent = "cerca de " + minutos + " min de moto";
    document.getElementById("preco").textContent = formatarDinheiro(preco);

    resultado.hidden = false;

    if (destino.aproximada) {
      mostrarMensagem("Não achei a rua exata no mapa, então a distância usa uma localização aproximada do bairro.", false);
    } else {
      mostrarMensagem("", false);
    }
  } catch (erro) {
    mostrarMensagem(erro.message, true);
  } finally {
    botao.disabled = false;
  }
});