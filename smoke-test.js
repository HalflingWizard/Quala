const fs = require("fs");
const vm = require("vm");

function makeClassList() {
  const classes = new Set();
  return {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
    contains: (item) => classes.has(item)
  };
}

function makeElement(id = "") {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    options: [],
    files: [],
    className: "",
    classList: makeClassList(),
    appendChild(child) {
      this.children = this.children || [];
      this.children.push(child);
      if (this.id === "modelSelect") this.options.push(child);
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    closest() {
      return makeElement();
    },
    click() {}
  };
}

const html = fs.readFileSync("index.html", "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));

const document = {
  getElementById(id) {
    return elements[id] || null;
  },
  createElement() {
    return makeElement();
  },
  querySelectorAll() {
    return [];
  }
};

const localStorage = {
  getItem() {
    return null;
  },
  setItem() {}
};

const context = {
  document,
  localStorage,
  Blob: function Blob() {},
  URL: {
    createObjectURL() {
      return "";
    },
    revokeObjectURL() {}
  },
  navigator: {
    clipboard: {
      writeText() {}
    }
  },
  fetch() {},
  console
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

if (!elements.modelSelect.options.length) {
  throw new Error("Preferences did not render model options.");
}

console.log("startup ok");
