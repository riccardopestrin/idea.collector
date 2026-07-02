import "@testing-library/jest-dom/vitest";

// jsdom non implementa ancora <dialog>.showModal/close: shim minimo per i test.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};
