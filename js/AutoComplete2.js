/*
  <auto-complete> component

  attributes:

    api       - API to call. e.g. https://myapi/search/${query} append the current value of the input with ID or name of "query"
    querymin - minimum number of characters to enter before an API search
    valid     - set to an error message to validate the entry

*/

class AutoComplete extends HTMLElement {

  static debounceDelay  = 500;          // input debounce delay
  static queryRegExp    = /\$\{(.+)\}/; // API query RegExp

  static componentCount = 0;            // components on page
  static cache          = {};           // cached API data


  constructor() {

    super();

    // component datalist ID
    this.listId = `auto-complete-datalist-${ ++AutoComplete.componentCount }`;

    // defaults
    this.querymin = 1;
    this.optionmax = 20;

  }


  // component attributes
  static get observedAttributes() {

    return ['api', 'resultdata', 'querymin', 'optionmax', 'valid'];

  }


  // attribute change
  attributeChangedCallback(property, oldValue, newValue) {

    if (oldValue === newValue) return;
    this[property] = newValue;

    // get query field from API URL
    if (property === 'api') {

      const
        fq = String(this.api).match(AutoComplete.queryRegExp),
        q = fq && fq[1] && fq[1].trim();

      this.inputId = q || null;
      this.input = q && (document.getElementById(q) || document.querySelector(`[name=${q}]`));
      this.inputDataName = this.input && (this.input.dataset.name || q);

    }

    // console.log('property', property, 'changed from', oldValue, 'to', newValue);

  }


  // initialize component
  connectedCallback() {

    if (!this.input) return;

    // initialize API cache
    AutoComplete.cache[this.api] = AutoComplete.cache[this.api] || {};
    this.apiData = AutoComplete.cache[this.api];

    // fetch inputs
    this.allInputs = this.getElementsByTagName('input');

    // create linked <datalist>
    const dl = document.createElement('datalist');
    dl.id = this.listId;
    this.datalist = this.appendChild(dl);
    this.input.setAttribute('autocomplete', this.listId);
    this.input.setAttribute('list', this.listId);

    // attach debounded input event handler
    let debounce;
    this.inputHandler = e => {

      clearTimeout(debounce);
      debounce = setTimeout(() => this.fetchMatches(e), AutoComplete.debounceDelay);

    };
    this.input.addEventListener('input', this.inputHandler);

    // check validity
    this.blurHandler = e => {

      if (!this.input || !this.valid) return;

      this.input.setCustomValidity(this.validValue() ? '' : this.valid);
      this.input.checkValidity();

    };
    this.input.addEventListener('blur', this.blurHandler);

  }


  // detach component
  disconnectedCallback() {

    if (!this.input) return;

    // remove event handlers
    this.input.removeEventListener('input', this.inputHandler);
    this.input.removeEventListener('blur', this.blurHandler);

    // remove datalist
    this.input.removeAttribute('list');
    this.datalist.remove();
    this.datalist = null;

  }


  // query API or fetch data from cache
  fetchMatches() {

    const query = this.input.value.trim();

    if (
      query.length < this.querymin ||
      this.apiData[query] ||
      ( this.currentQuery && this.currentQuery.complete && query.toLowerCase().startsWith(this.currentQuery.toLowerCase()) )
    ) {

      // use cached data
      this.datalistUpdate(query);
      return;

    }

    // fetch data
    this.apiData[query] = this.apiData[query] || {};
    const store = this.apiData[query];

    fetch(this.api.replace(AutoComplete.queryRegExp, query))
      .then(res => res.json())
      .then(data => {

        store.data = [];
        store.frag = document.createDocumentFragment();
        store.complete = true;

        if (!data) return;

        // find result data
        data = (this.resultdata && data[this.resultdata]) || data;

        // store data
        store.data = Array.isArray(data) ? data : [ data ];
        const dlen = store.data.length;
        store.complete = dlen <= this.optionmax;

        // create DOM fragment
        for (let d = 0, optMax = this.optionmax; d < dlen && optMax > 0; d++) {

          const value = store.data[d][this.inputDataName];
          if (value) {
            const o = document.createElement('option');
            o.value = value;
            store.frag.appendChild(o);
            optMax--;
          }

        }

        this.datalistUpdate(query);

      });

  }


  // update datalist from cache
  datalistUpdate(query) {

    const valid = this.validValue();

    if (query && this.apiData[query]) {

      this.currentQuery = query;
      this.datalist.replaceChildren( this.apiData[query].frag.cloneNode(true) );

    }
    else if (query.length < this.querymin) {

      // this.datalist.replaceChildren( document.createDocumentFragment() );
      this.datalist.innerHTML = '';
      this.currentQuery = null;

    }

    // update linked inputs
    Array.from(this.allInputs).forEach(i => {

      const name = i.dataset.name || i.name || i.id;
      if (name && i !== this.input) i.value = valid && valid[name] ? valid[name] : '';

    });


  }


  // is query value valid?
  validValue() {

    const query = this.input && this.input.value.trim();
    if (!query || !this.currentQuery) return null;

    return this.apiData[this.currentQuery].data.find(d => query === d[this.inputDataName]);

  }

}


// register component
window.customElements.define('auto-complete', AutoComplete);
