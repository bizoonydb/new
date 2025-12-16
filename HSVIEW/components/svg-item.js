class SvgItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          margin-bottom: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        :host(:hover) {
          background-color: #f9fafb;
        }
        :host(.active) {
          background-color: #fef3c7;
          border-color: #f59e0b;
        }
.container {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .actions {
          display: flex;
          gap: 0.5rem;
        }
        
        button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 0.25rem;
        }
        
        button:hover {
          background-color: #f3f4f6;
        }
        .edit-btn {
          color: #f59e0b;
        }
.delete-btn {
          color: #ef4444;
        }
      </style>
      <div class="container">
        <span class="name"></span>
        <div class="actions">
          <button class="edit-btn">
            <i data-feather="edit-2"></i>
          </button>
          <button class="delete-btn">
            <i data-feather="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  connectedCallback() {
    this.shadowRoot.querySelector('.name').textContent = this.getAttribute('name') || 'SVG Element';
    
    this.shadowRoot.querySelector('.edit-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('edit', { bubbles: true, composed: true }));
    });
    
    this.shadowRoot.querySelector('.delete-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true }));
    });
    
    // Initialize feather icons
    if (window.feather) {
      window.feather.replace({ class: 'feather', width: 16, height: 16 });
    }
  }

  setActive(active) {
    if (active) {
      this.classList.add('active');
    } else {
      this.classList.remove('active');
    }
  }
}

customElements.define('svg-item', SvgItem);