const statusDiv = document.getElementById("status");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatContainer = document.getElementById("chat-container");

// Iniciamos el historial inyectando las directrices del archivo demo-data.js
let historial = [
    { role: "system", content: ASISTENTE_LEGAL_DATA.systemPrompt }
];

function agregarMensaje(texto, remitente) {
    const msg = document.createElement("div");
    msg.className = `message ${remitente}`;
    msg.innerText = texto;
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function verificarOllama() {
    try {
        const res = await fetch("http://localhost:11434/api/tags");
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        const modelos = (data.models || []).map(m => m.name).join(", ");
        statusDiv.innerText = `Estado: Conectado a Ollama. Modelos: ${modelos || "ninguno"}`;
        
        userInput.disabled = false;
        sendBtn.disabled = false;
    } catch (e) {
        statusDiv.innerHTML = `<strong>Error:</strong> No se encontró Ollama en http://localhost:11434. Asegúrate de iniciar la aplicación local.`;
        console.error(e);
    }
}

async function enviarConsulta() {
    const text = userInput.value.trim();
    if (!text) return;

    agregarMensaje(text, "user");
    userInput.value = "";
    statusDiv.innerText = "La IA está redactando...";

    historial.push({ role: "user", content: text });
    
    // Control de memoria de contexto (mantenemos las directrices del sistema + últimas interacciones)
    if (historial.length > 21) {
        historial = [
            historial[0], // Mantener system prompt
            ...historial.slice(-20)
        ];
    }

    const iaMessageDiv = document.createElement("div");
    iaMessageDiv.className = "message ia";
    iaMessageDiv.innerText = "...";
    chatContainer.appendChild(iaMessageDiv);

    try {
        const res = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.2",
                messages: historial,
                stream: true
            })
        });
        
        if (!res.ok) throw new Error("Error del servidor: " + res.status);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let respuestaCompleta = "";
        let buffer = ""; // Buffer para manejar fragmentos JSON parciales

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lineas = buffer.split("\n");
            
            // Guardamos la última línea por si quedó incompleta en el chunk actual
            buffer = lineas.pop(); 

            for (const linea of lineas) {
                if (!linea.trim()) continue;
                try {
                    const obj = JSON.parse(linea);
                    const contenido = obj.message?.content || "";
                    if (contenido) {
                        respuestaCompleta += contenido;
                        iaMessageDiv.innerText = respuestaCompleta;
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                } catch (e) {
                    // Ignorar errores de parseo transitorios de líneas cortadas
                }
            }
        }
        
        historial.push({ role: "assistant", content: respuestaCompleta });
        statusDiv.innerText = "Estado: IA Lista.";
    } catch (e) {
        iaMessageDiv.innerText = "Error al procesar la respuesta. Revisa la consola o tu servidor Ollama.";
        statusDiv.innerText = "Estado: Error de conexión.";
        console.error(e);
    }
}

sendBtn.addEventListener("click", enviarConsulta);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") enviarConsulta();
});

// Inicialización
verificarOllama();
