/* MOVT web — login, registro e recuperação de senha */
import { login, recovery, register } from "../core/auth.js";
import { ROUTES } from "../core/config.js";
import { session } from "../core/session.js";
import { initMobileMenu } from "../components/mobile-menu.js";
import { digits, isEmail, maskCNPJ, maskCPF, maskPhone } from "../utils/masks.js";

(() => {
  // Já logado → vai direto ao dashboard
  if (session.id) {
    location.replace(ROUTES.dashboard);
    return;
  }

  const tabs = document.querySelector(".tabs");
  const panels = {
    login: document.getElementById("panel-login"),
    register: document.getElementById("panel-register"),
    recovery: document.getElementById("panel-recovery"),
  };

  const show = (name) => {
    Object.entries(panels).forEach(([k, p]) => p.classList.toggle("active", k === name));
    tabs.classList.toggle("is-hidden", name === "recovery");
    if (name !== "recovery") {
      tabs.dataset.active = name;
      tabs.querySelectorAll(".tab").forEach((t) => {
        const on = t.dataset.tab === name;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on);
      });
    }
    history.replaceState(null, "", name === "login" ? location.pathname : `#${name}`);
    panels[name].querySelector("input")?.focus({ preventScroll: true });
  };

  tabs.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => show(b.dataset.open)));
  if (location.hash === "#register" || location.hash === "#registrar") show("register");
  else if (location.hash === "#recovery") show("recovery");

  // Mostrar/ocultar senha
  document.querySelectorAll(".pw-toggle").forEach((b) =>
    b.addEventListener("click", () => {
      const input = b.previousElementSibling;
      const on = input.type === "password";
      input.type = on ? "text" : "password";
      b.classList.toggle("on", on);
      b.setAttribute("aria-label", on ? "Ocultar senha" : "Mostrar senha");
    })
  );

  /* ---------- Helpers de formulário ---------- */
  const msg = (form, text, ok = false) => {
    const el = form.querySelector(".form-msg");
    el.textContent = text || "";
    el.classList.toggle("ok", ok);
    if (text && !ok) {
      form.classList.remove("shake");
      void form.offsetWidth;
      form.classList.add("shake");
    }
  };
  const busy = (form, on) => {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = on;
    btn.classList.toggle("loading", on);
  };
  const markInvalid = (form, names) => {
    form.querySelectorAll("input").forEach((i) => i.classList.toggle("invalid", names.includes(i.name)));
  };

  /* ---------- Documento e telefone ---------- */
  const reg = panels.register;
  const docInput = reg.elements.cpf_cnpj;
  const docType = () => reg.querySelector('input[name="tipo_documento"]:checked').value;
  reg.querySelectorAll('input[name="tipo_documento"]').forEach((r) =>
    r.addEventListener("change", () => {
      docInput.value = "";
      docInput.placeholder = docType() === "CPF" ? "000.000.000-00" : "00.000.000/0000-00";
      docInput.focus();
    })
  );
  docInput.addEventListener("input", () => {
    docInput.value = docType() === "CPF" ? maskCPF(docInput.value) : maskCNPJ(docInput.value);
  });
  reg.elements.telefone.addEventListener("input", (e) => (e.target.value = maskPhone(e.target.value)));

  /* ---------- Login ---------- */
  panels.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = panels.login;
    const email = f.elements.email.value.trim();
    const senha = f.elements.senha.value;
    const bad = [];
    if (!isEmail(email)) bad.push("email");
    if (!senha) bad.push("senha");
    markInvalid(f, bad);
    if (bad.length) return msg(f, "Por favor, preencha e-mail e senha corretamente.");

    msg(f, "");
    busy(f, true);
    try {
      await login(email, senha);
      msg(f, "Login efetuado! Redirecionando…", true);
      location.href = ROUTES.dashboard;
    } catch (err) {
      msg(f, err.status === 401 || err.status === 400 ? err.message || "E-mail ou senha inválidos." : err.message);
      busy(f, false);
    }
  });

  /* ---------- Registro ---------- */
  reg.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(reg));
    const docDigits = digits(v.cpf_cnpj || "");
    const bad = [];
    if ((v.nome || "").trim().length < 2) bad.push("nome");
    if (!isEmail((v.email || "").trim())) bad.push("email");
    if (docDigits.length !== (v.tipo_documento === "CPF" ? 11 : 14)) bad.push("cpf_cnpj");
    if (!v.data_nascimento) bad.push("data_nascimento");
    if (digits(v.telefone || "").length < 10) bad.push("telefone");
    if ((v.senha || "").length < 6) bad.push("senha");
    markInvalid(reg, bad);
    if (bad.length) return msg(reg, "Revise os campos destacados.");

    msg(reg, "");
    busy(reg, true);
    try {
      const data = await register({
        nome: v.nome.trim(),
        email: v.email.trim(),
        senha: v.senha,
        cpf_cnpj: v.cpf_cnpj,
        data_nascimento: v.data_nascimento,
        telefone: v.telefone,
        tipo_documento: v.tipo_documento,
      });
      reg.reset();
      show("login");
      panels.login.elements.email.value = v.email.trim();
      msg(panels.login, (data && data.message) || "Conta criada! Faça login para continuar.", true);
    } catch (err) {
      msg(reg, err.message);
    } finally {
      busy(reg, false);
    }
  });

  /* ---------- Recuperação de senha ---------- */
  const rec = panels.recovery;
  let step = 1;
  const stepCopy = {
    1: ["Informe seu e-mail e enviaremos um código de verificação.", "Enviar código"],
    2: ["Digite o código que enviamos para o seu e-mail.", "Verificar código"],
    3: ["Código confirmado. Defina sua nova senha.", "Redefinir senha"],
  };
  const setStep = (n) => {
    step = n;
    rec.querySelectorAll("[data-step]").forEach((el) => (el.hidden = !el.dataset.step.split(" ").includes(String(n))));
    rec.elements.email.readOnly = n > 1;
    rec.elements.code.readOnly = n > 2;
    rec.querySelector("[data-step-text]").textContent = stepCopy[n][0];
    rec.querySelector('button[type="submit"] span').textContent = stepCopy[n][1];
    const next = n === 2 ? rec.elements.code : n === 3 ? rec.elements.newPassword : null;
    next?.focus();
  };
  rec.querySelector(".back").addEventListener("click", () => { setStep(1); msg(rec, ""); });

  rec.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = rec.elements.email.value.trim();
    const code = rec.elements.code.value.trim();
    const newPassword = rec.elements.newPassword.value;
    if (!isEmail(email)) { markInvalid(rec, ["email"]); return msg(rec, "Informe um e-mail válido."); }
    if (step === 2 && !code) { markInvalid(rec, ["code"]); return msg(rec, "Informe o código recebido."); }
    if (step === 3 && newPassword.length < 6) { markInvalid(rec, ["newPassword"]); return msg(rec, "A senha deve ter pelo menos 6 caracteres."); }
    markInvalid(rec, []);
    msg(rec, "");
    busy(rec, true);
    try {
      if (step === 1) {
        await recovery.request(email);
        setStep(2);
      } else if (step === 2) {
        await recovery.verify(email, code);
        setStep(3);
      } else {
        await recovery.reset(email, code, newPassword);
        rec.reset();
        setStep(1);
        show("login");
        panels.login.elements.email.value = email;
        msg(panels.login, "Senha redefinida! Faça login com a nova senha.", true);
      }
    } catch (err) {
      msg(rec, err.message);
    } finally {
      busy(rec, false);
    }
  });

  initMobileMenu();
})();
