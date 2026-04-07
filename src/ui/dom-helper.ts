export class DomHelper {
  public static getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id ${id} not found.`);
    }
    return element as T;
  }

  public static setText(id: string, text: string): void {
    const element = this.getElement(id);
    element.textContent = text;
  }

  public static show(id: string): void {
    const element = this.getElement(id);
    element.style.display = 'block';
  }

  public static hide(id: string): void {
    const element = this.getElement(id);
    element.style.display = 'none';
  }
}
