let nome = document.querySelector(".nome");
let personagem = document.querySelector(".personagem");

function escolherPersonagem(nomePersonagem, imagemPersonagem, cor) {
    nome.innerHTML = nomePersonagem;
    personagem.src = imagemPersonagem;
    nome.style.color = cor;
    personagem.style.mixBlendMode = "normal";
}

async function lerFoto(input) {
    const foto = input.files[0];

    if (!foto) return;

    if (!foto.type.startsWith("image/")) {
        alert("Selecione um arquivo de imagem.");
        return;
    }

    try {
        // Lê a foto escolhida pelo usuário
        const leitor = new FileReader();

        const imagemOriginal = await new Promise((resolve, reject) => {
            leitor.onload = () => resolve(leitor.result);
            leitor.onerror = () => reject(new Error("Não foi possível ler a foto."));
            leitor.readAsDataURL(foto);
        });

        // Avisa que a IA está trabalhando
        nome.textContent = "CRIANDO PERSONAGEM...";

        // Envia a foto para a IA transformar usando o modelo padrão compatível
        const imagemGerada = await puter.ai.txt2img(
            "Transform this person into a video game character. " +
            "Keep the person's face recognizable. Bold black outlines, " +
            "vibrant colors, stylized comic book game art, half body portrait. " +
            "Isolated character on a solid pure white background, no scenery, no ground, no shadow, easy to cutout.",
            
            {
                input_image: imagemOriginal
            }
        );

        // Mostra a imagem criada na página (compatível com HTMLImageElement ou URL direta)
        if (imagemGerada instanceof HTMLImageElement) {
            personagem.src = imagemGerada.src;
        } else if (typeof imagemGerada === "string") {
            personagem.src = imagemGerada;
        } else if (imagemGerada && imagemGerada.src) {
            personagem.src = imagemGerada.src;
        }

        nome.textContent = "Meu personagem";
        nome.style.color = "#ec0b0b";

    } catch (erro) {
        console.error("Erro ao gerar personagem:", erro);
        alert("Não foi possível gerar o personagem. Verifique a conexão e tente novamente.");
    } finally {
        // Permite escolher a mesma foto novamente
        input.value = "";
    }
}