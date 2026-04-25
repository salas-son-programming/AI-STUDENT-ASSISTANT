// API KEY
const API_Key = "sk-------"; // Because my API key is secret

//  GLOBAL STATE
let currentText = "";

let cache = {
    explain: null,
    summarize: null
};


//  NEW STUDY

function goToNewStudy() {
    document.getElementById("userInput").value = "";
    currentText = "";

    cache = {
        explain: null,
        summarize: null
    };

    document.getElementById("new_study").style.display = "block";
    document.getElementById("analyze").style.display = "none";
    document.getElementById("history").style.display = "none";

    document.getElementById("Api_result_explantion").innerText = "";
    document.getElementById("Api_result_summarize").innerText = "";

    document.getElementById("explanation").style.display = "none";
    document.getElementById("summary").style.display = "none";
}

// connect buttons safely
const btn1 = document.getElementById("newStudyBtn1");
const btn2 = document.getElementById("newStudyBtn2");

if (btn1) btn1.onclick = goToNewStudy;
if (btn2) btn2.onclick = goToNewStudy;


//  ANALYSE BUTTON

document.getElementById("analyse").onclick = () => {
    const input = document.getElementById("userInput").value;

    if (!input.trim()) {
        alert("Please enter some text");
        return;
    }

    currentText = input;

    cache = {
        explain: null,
        summarize: null
    };

    document.getElementById("new_study").style.display = "none";
    document.getElementById("history").style.display = "none";
    document.getElementById("analyze").style.display = "block";

    document.getElementById("explanation").style.display = "none";
    document.getElementById("summary").style.display = "none";
};


// AI FUNCTION

async function askAI(type) {

    if (cache[type]) {
        return cache[type];
    }

    let systemPrompt = "";

    if (type === "explain") {
        systemPrompt = `
                    Explain this like a teacher USING CONCRET EXAMPLES.

                    STRICT RULES:
                    - Do NOT use LaTeX (no \\frac, no \\ symbols)
                    - Write math using simple keyboard notation only
                    - Use formats like:
                    ds/dt
                    x^2
                    2x + 3
                    - Never write things like \\frac{a}{b}
                    - Keep everything readable for beginners

                    Use clear examples and simple language.
                    `;
    }

    if (type === "summarize") {
            systemPrompt = `
            Summarize IN SUCH A WAY I CAN UNDERSTAND EASILY.

            RULES:
            - Use simple language
            - Use simple math notation (ds/dt, x^2)
            - Do NOT use LaTeX or special symbols
`;    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_Key}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentText }
            ]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        alert("API error");
        return;
    }

    const result = data.choices[0].message.content;

    cache[type] = result;

    saveToHistory(type, currentText, result);
    loadRecentActivity();

    return result;
}


//  SAVE HISTORY

function saveToHistory(type, input, output) {
    const history = JSON.parse(localStorage.getItem("history")) || [];

    history.push({
        type,
        input,
        output,
        date: new Date().toLocaleString()
    });

    localStorage.setItem("history", JSON.stringify(history));
}


//  LOAD HISTORY

function loadHistory() {
    const history = JSON.parse(localStorage.getItem("history")) || [];

    const container = document.getElementById("activities_2");
    container.innerHTML = "";

    history.reverse().forEach(item => {
        const div = document.createElement("div");

        div.classList.add("history-item");

        div.innerHTML = `
            <strong>${item.type}</strong>
            <p>${item.input}</p>
            <small>${item.date}</small>
        `;

        div.onclick = () => {
            currentText = item.input;
            cache[item.type] = item.output;
            showAnalyzePage(item.type, item.output);
        };

        container.appendChild(div);
    });
}


//  RECENT ACTIVITY

function loadRecentActivity() {
    const history = JSON.parse(localStorage.getItem("history")) || [];

    const container = document.getElementById("activities");
    container.innerHTML = "";

    history.slice(-3).reverse().forEach(item => {
        const div = document.createElement("div");

        div.classList.add("history-item");

        div.innerHTML = `
            <strong>${item.type}</strong>
            <p>${item.input}</p>
        `;

        div.onclick = () => {
            currentText = item.input;
            cache[item.type] = item.output;
            showAnalyzePage(item.type, item.output);
        };

        container.appendChild(div);
    });
}


// SHOW ANALYZE PAGE

function makeLinksClickable(text) {
    return text.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" style="color:#6366f1;">$1</a>'
    );
}

function cleanText(text) {
    return text
        .replace(/\\+/g, "")        
        .replace(/\[|\]/g, "")      
        .replace(/\*\*/g, "");      
}

function showAnalyzePage(type, content) {

    document.getElementById("new_study").style.display = "none";
    document.getElementById("history").style.display = "none";
    document.getElementById("analyze").style.display = "block";

    const explanationDiv = document.getElementById("explanation");
    const summaryDiv = document.getElementById("summary");

    //  PROCESS CONTENT
    let processed = cleanText(content);              
    processed = marked.parse(processed);             
    processed = makeLinksClickable(processed);       

    if (type === "explain") {
        explanationDiv.style.display = "block";
        summaryDiv.style.display = "none";
        document.getElementById("Api_result_explantion").innerHTML = processed;
    }

    if (type === "summarize") {
        explanationDiv.style.display = "none";
        summaryDiv.style.display = "block";
        document.getElementById("Api_result_summarize").innerHTML = processed;
    }
}


//  EXPLAIN BUTTON

document.querySelector("#analyse_btns button:nth-child(1)").onclick = async () => {

    showAnalyzePage("explain", "Loading... please wait ⏳");

    const result = await askAI("explain");

    showAnalyzePage("explain", result);
};


//  SUMMARIZE BUTTON

document.querySelector("#analyse_btns button:nth-child(2)").onclick = async () => {

    showAnalyzePage("summarize", "Loading... please wait ⏳");

    const result = await askAI("summarize");

    showAnalyzePage("summarize", result);
};


//  ACTION CARDS

document.getElementById("explain").onclick = () => {
    document.getElementById("analyse").click();
    setTimeout(() => {
        document.querySelector("#analyse_btns button:nth-child(1)").click();
    }, 100);
};

document.getElementById("summarize").onclick = () => {
    document.getElementById("analyse").click();
    setTimeout(() => {
        document.querySelector("#analyse_btns button:nth-child(2)").click();
    }, 100);
};


//  CLEAR TEXTAREA

document.getElementById("clear_textarea").onclick = () => {
    document.getElementById("userInput").value = "";
};


// HISTORY BUTTON

document.querySelector("#sub_boards button:nth-child(2)").onclick = () => {
    document.getElementById("new_study").style.display = "none";
    document.getElementById("analyze").style.display = "none";
    document.getElementById("history").style.display = "block";

    loadHistory();
};

//  VIEW ALL HISTORY

document.querySelector("#body_scond_part button").onclick = () => {
    document.getElementById("new_study").style.display = "none";
    document.getElementById("analyze").style.display = "none";
    document.getElementById("history").style.display = "block";

    loadHistory();
};


//  CLEAR HISTORY

document.querySelector("#history button").onclick = () => {
    localStorage.removeItem("history");
    loadHistory();
};

//  INIT

loadRecentActivity();