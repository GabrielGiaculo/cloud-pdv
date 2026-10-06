/* =======================================================
   UI GENÉRICA: toast de aviso, modais e overlay
   ======================================================= */

function mostrarAviso(texto, col = "#ef4444") {
    let toast = document.getElementById("toast");
    toast.innerText = texto;
    toast.style.background = col;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 3000);
}

function fecharModais() {
    document.getElementById("receipt").style.display = "none";
    document.getElementById("fechamento").style.display = "none";
    document.getElementById("overlay").style.display = "none";
    document.body.classList.remove("print-receipt", "print-fechamento");
    document.getElementById("busca").focus();
}
