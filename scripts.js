// ---------- Elementos da página ----------
const nome = document.querySelector(".nome");
const personagem = document.querySelector(".personagem");
const carregando = document.querySelector(".carregando");
const botaoFoto = document.querySelector("#botao-foto");
const inputFoto = document.querySelector("#input-foto");
const dica = document.querySelector(".dica");

const TAMANHO_MAXIMO_MB = 5;

// Fundos sorteados quando a IA gera o personagem.
// Por padrão usa os mesmos fundos dos personagens prontos (lidos do data-fundo no HTML).
// Se quiser incluir outros arquivos, coloque o caminho em FUNDOS_EXTRAS.
const FUNDOS_EXTRAS = [
    // "img/outro-fundo.png",
];
const FUNDOS_IA = [
    ...new Set([
        ...[...document.querySelectorAll(".avatar-btn")].map((botao) => botao.dataset.fundo),
        ...FUNDOS_EXTRAS
    ])
].filter(Boolean);
let ultimoFundoIA = null;

// Sorteia um fundo da lista, sem repetir o anterior (quando houver mais de um)
function sortearFundo() {
    if (FUNDOS_IA.length === 0) return null;
    if (FUNDOS_IA.length === 1) return FUNDOS_IA[0];

    let sorteado;
    do {
        sorteado = FUNDOS_IA[Math.floor(Math.random() * FUNDOS_IA.length)];
    } while (sorteado === ultimoFundoIA);

    ultimoFundoIA = sorteado;
    return sorteado;
}

// ---------- Mensagens rápidas na tela ----------
let temporizadorDica = null;

function mostrarDica(texto, segundos = 7) {
    dica.textContent = texto;
    dica.hidden = false;
    clearTimeout(temporizadorDica); // cancela o "esconder" anterior, se houver
    temporizadorDica = setTimeout(() => {
        dica.hidden = true;
    }, segundos * 1000);
}

// ---------- Login no Puter ----------
// O navegador só deixa abrir a janela de login se ela nascer direto de um clique.
// Por isso o login acontece AQUI, no clique do botão da câmera, e não depois
// que a pessoa já escolheu a foto.
async function aoClicarNoBotaoFoto() {
    if (typeof puter === "undefined") {
        alert("O serviço de IA não carregou. Verifique a conexão e recarregue a página.");
        return;
    }

    if (!(await puter.auth.isSignedIn())) {
        mostrarDica("Para criar seu personagem com IA, entre com sua conta Puter.", 10);
        botaoFoto.disabled = true;
        try {
            await puter.auth.signIn();
            mostrarDica("Login feito! Clique no 📷 de novo para escolher sua foto.");
        } catch (erro) {
            console.error("Erro no login:", erro);
            mostrarDica("Não foi possível entrar. Clique no 📷 para tentar de novo.");
        } finally {
            botaoFoto.disabled = false;
        }
        return;
    }

    inputFoto.click(); // já está logado: abre a escolha de foto
}

// ---------- Trocar o fundo da página ----------
// Carrega a imagem "escondida" primeiro e só troca quando ela estiver pronta.
// Assim não aparece um piscar de tela vazia.
function trocarFundo(endereco) {
    if (!endereco) return;
    const teste = new Image();
    teste.onload = () => {
        document.body.style.backgroundImage = `url("${endereco}")`;
    };
    teste.onerror = () => console.warn("Fundo não encontrado:", endereco);
    teste.src = endereco;
}

// ---------- Escolher um personagem pronto ----------
function escolherPersonagem(nomePersonagem, imagemPersonagem, cor, fundo) {
    nome.textContent = nomePersonagem; // textContent: só texto, mais seguro que innerHTML
    nome.style.color = cor;
    personagem.src = imagemPersonagem;
    personagem.alt = "Personagem " + nomePersonagem;
    personagem.style.mixBlendMode = "normal"; // imagens prontas já têm fundo transparente
    trocarFundo(fundo);
}

// ---------- Ler a foto e transformar em texto (base64) ----------
// O FileReader usa callbacks. Aqui ele é embrulhado numa Promise
// para podermos usar "await" com ele.
function lerArquivo(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível ler a foto."));
        leitor.readAsDataURL(arquivo);
    });
}

// A API pode devolver formatos diferentes. Esta função descobre onde está a imagem.
function pegarEndereco(resultado) {
    if (typeof resultado === "string") return resultado;
    if (resultado && resultado.src) return resultado.src; // serve para <img> e objetos com .src
    return null;
}

// ---------- Remover o fundo branco ----------
function carregarImagem(endereco) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // necessário para o canvas poder ler os pixels
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Não foi possível carregar a imagem gerada."));
        img.src = endereco;
    });
}

// Começa pelas bordas da imagem e apaga o branco que está "ligado" a elas.
// Assim o branco de dentro do personagem (olhos, roupa) é preservado.
// tolerancia: de 0 a 255. Quanto menor, mais tons de cinza claro são apagados.
async function removerFundoBranco(endereco, tolerancia = 235) {
    const img = await carregarImagem(endereco);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    // Se a imagem vier de outro site sem permissão (CORS), esta linha dá erro.
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = dados.data; // sequência de R, G, B, A de cada pixel
    const { width, height } = canvas;

    const visitado = new Uint8Array(width * height);
    const pilha = [];

    const ehBranco = (i) =>
        px[i * 4] >= tolerancia && px[i * 4 + 1] >= tolerancia && px[i * 4 + 2] >= tolerancia;

    const empilhar = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = y * width + x;
        if (visitado[i] || !ehBranco(i)) return;
        visitado[i] = 1;
        pilha.push(i);
    };

    // Pontos de partida: todas as bordas
    for (let x = 0; x < width; x++) { empilhar(x, 0); empilhar(x, height - 1); }
    for (let y = 0; y < height; y++) { empilhar(0, y); empilhar(width - 1, y); }

    // Espalha pelos vizinhos brancos, tornando cada pixel transparente
    while (pilha.length) {
        const i = pilha.pop();
        px[i * 4 + 3] = 0; // canal alfa = 0 (transparente)
        const x = i % width;
        const y = (i - x) / width;
        empilhar(x + 1, y);
        empilhar(x - 1, y);
        empilhar(x, y + 1);
        empilhar(x, y - 1);
    }

    ctx.putImageData(dados, 0, 0);
    return canvas.toDataURL("image/png");
}

// ---------- Gerar o personagem com IA ----------
async function lerFoto(input) {
    const foto = input.files[0];

    // Pessoa abriu a galeria e cancelou
    if (!foto) return;

    // Validações antes de gastar tempo (e uso da IA)
    if (!foto.type.startsWith("image/")) {
        alert("Selecione um arquivo de imagem.");
        input.value = "";
        return;
    }

    if (foto.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
        alert("A foto passa de " + TAMANHO_MAXIMO_MB + " MB. Escolha uma menor.");
        input.value = "";
        return;
    }

    // Se o script do Puter não carregou (sem internet, por exemplo)
    if (typeof puter === "undefined") {
        alert("O serviço de IA não carregou. Verifique a conexão e recarregue a página.");
        input.value = "";
        return;
    }

    try {
        const imagemOriginal = await lerArquivo(foto);

        // Mensagem de carregamento própria. O nome do personagem NÃO é alterado,
        // então se der erro não sobra "CRIANDO PERSONAGEM..." na tela.
        dica.hidden = true;
        carregando.hidden = false;
        botaoFoto.disabled = true;

        const imagemGerada = await puter.ai.txt2img(
            "Transform this person into a video game character. " +
            "Keep the person's face recognizable. Bold black outlines, " +
            "vibrant colors, stylized comic book game art, half body portrait. " +
            "Isolated character on a solid pure white background, no scenery, no ground, no shadow, easy to cutout.",
            { input_image: imagemOriginal }
        );

        const endereco = pegarEndereco(imagemGerada);
        if (!endereco) {
            throw new Error("A IA respondeu em um formato inesperado.");
        }

        // Tenta apagar o fundo branco. Se não der (ex.: bloqueio de CORS),
        // mostra a imagem do jeito que veio, em vez de quebrar.
        let enderecoFinal = endereco;
        try {
            enderecoFinal = await removerFundoBranco(endereco);
        } catch (erroFundo) {
            console.warn("Não foi possível remover o fundo:", erroFundo);
        }

        personagem.src = enderecoFinal;
        personagem.alt = "Meu personagem criado com IA";
        personagem.style.mixBlendMode = "normal";

        nome.textContent = "Meu personagem";
        nome.style.color = "#ec0b0b";
        trocarFundo(sortearFundo());

    } catch (erro) {
        console.error("Erro ao gerar personagem:", erro);
        alert("Não foi possível gerar o personagem. Verifique a conexão e tente novamente.");

    } finally {
        // Roda sempre, deu certo ou errado
        carregando.hidden = true;
        botaoFoto.disabled = false;
        input.value = ""; // permite escolher a mesma foto de novo
    }
}

// ---------- Ligando os eventos (no lugar dos onclick dentro do HTML) ----------
document.querySelectorAll(".avatar-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
        escolherPersonagem(botao.dataset.nome, botao.dataset.img, botao.dataset.cor, botao.dataset.fundo);
    });
});

botaoFoto.addEventListener("click", aoClicarNoBotaoFoto);
inputFoto.addEventListener("change", () => lerFoto(inputFoto));

// Pré-carrega todos os fundos para a troca ser instantânea
document.querySelectorAll("[data-fundo]").forEach((el) => {
    new Image().src = el.dataset.fundo;
});
FUNDOS_IA.forEach((endereco) => {
    new Image().src = endereco;
});
