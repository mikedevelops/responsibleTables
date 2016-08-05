// TODO public method for returning table(s)
// TODO: handle tfoot
// TODO: handle tables with no th's
// TODO: handle duplicate ID's

require('classlist-polyfill');

const _defaultsDeep = require('lodash.defaultsDeep');

class ResponsibleTables {
    constructor (options) {
        ResponsibleTables.VERSION = '1.0.4';

        // defaults
        this.defaults = {
            activeClass: 'responsibleTable--active',
            columnHeadingClass: 'responsibleTable__column-heading',
            containerSelector: '.container',
            debounceRate: 200,
            subHeadingClass: 'responsibleTable__sub-heading',
            tableDataClass: 'responsibleTable__table-data',
            tableSelector: '.responsibleTable',
            debug: false
        };

        this.options = _defaultsDeep({}, options, this.defaults);

        // vars
        this.originalTables = [].slice.call(document.querySelectorAll(this.options.tableSelector));
        this.tableData = [];
        this.testData = {
            start: 0,
            finish: 0,
            result () {
                return Math.round(this.finish - this.start) ? `${Math.round(this.finish - this.start)}` : '< 1';
            }
        };

        this.registerEvents();
        this.init();
    }

    /**
     * initiate data, cache table, build / not build
     * @param force {boolean}
     */
    init (force = false) {
        this.originalTables.forEach((table, index) => {
            // create tableData object per instance
            this.initiateTableData(table, index);

            const { currentWidth, container, cache } = this.tableData[index];

            // cache original state
            if (!cache.original) {
                this.cacheTable(table, index);
            }

            // to build or not to build...
            if (currentWidth > container.width) {
                this.tableData[index].minWidth = currentWidth;
            }

            const { minWidth } = this.tableData[index];

            if (minWidth > container.width) {
                this.build(table, index);
            }
        });
    }

    /**
     * refresh table state, update table & container width, build / not build
     */
    refresh () {
        this.originalTables.forEach((table, index) => {
            const { node } = this.tableData[index];

            this.tableData[index].currentWidth = node.getBoundingClientRect().width;

            const { currentWidth, container, isResponsible } = this.tableData[index];

            if (container.node) {
                container.width = container.node.getBoundingClientRect().width;
            }

            // to build or not to build...
            if (currentWidth > container.width) {
                this.tableData[index].minWidth = currentWidth;
            }

            const { minWidth } = this.tableData[index];

            if (minWidth > container.width) {
                this.build(table, index);
            }
            else if (minWidth !== 0 && minWidth < container.width && isResponsible) {
                this.restoreTable(index);
            }
        });
    }

    /**
     * cache original & responsible version of table outerHTML
     * @param table {Element}
     * @param index {int}
     */
    cacheTable (table, index) {
        if (!this.tableData[index].isResponsible) {
            this.tableData[index].cache.original = table.outerHTML;
        }
        else {
            this.tableData[index].cache.responsible = table.outerHTML;
        }
    }

    /**
     * create table data object
     * @param table {Element}
     * @param index {int}
     */
    initiateTableData (table, index) {
        this.tableData[index] = {
            currentWidth: 0,
            isResponsible: false,
            hasChanged: false,
            minWidth: 0,
            node: null,
            cache: {
                original: '',
                responsible: ''
            },
            rows: {
                nodes: null,
                length: 0
            },
            columns: {
                nodes: null,
                length: 0
            },
            headings: {
                nodes: null,
                titles: []
            },
            container: {
                node: null,
                width: 0
            },
            fragment: null
        };

        // original table node
        this.tableData[index].node = table;
        // width
        this.tableData[index].currentWidth = table.getBoundingClientRect().width;
        // rows
        this.tableData[index].rows.nodes = this.getRows(table);
        this.tableData[index].rows.length = this.tableData[index].rows.nodes.length;
        // columns
        this.tableData[index].columns.nodes = this.getColumns(table);
        this.tableData[index].columns.length = this.tableData[index].columns.nodes.length;
        // headings
        this.tableData[index].headings.titles = this.getTableHeadings(table, index);
        // container
        this.tableData[index].container.node = document.querySelector(this.options.containerSelector) || null;
        if (this.tableData[index].container.node) {
            this.tableData[index].container.width = this.tableData[index].container.node.getBoundingClientRect().width;
        }
        // fragment
        this.tableData[index].fragment = document.createDocumentFragment();
    }

    /**
     * build responsible table
     * @param table {Element}
     * @param tableIndex {int}
     * @returns {boolean}
     */
    build (table, tableIndex) {
        const { rows, cache, node } = this.tableData[tableIndex];

        if (this.options.debug) {
            this.testData.start = performance.now();
        }

        if (!this.tableData[tableIndex].hasChanged) {
                // append first row to fragment
                this.tableData[tableIndex].fragment = (this.buildFirstRow(table, tableIndex));

                // loop through rows excluding the first and build out the data
                rows.nodes.forEach((row, index) => {
                    if (index) {
                        this.tableData[tableIndex].fragment += this.buildTableData(table, tableIndex, index);
                    }
                });

                // switch out innerHTML of old table for new
                // IE9 YAY!
                this.replaceTableHTML(table, tableIndex);

                table.classList.add(this.options.activeClass);

                // update config with new node
                this.tableData[tableIndex].node = table;

                // record state change
                this.tableData[tableIndex].hasChanged = true;
                this.tableData[tableIndex].isResponsible = true;

                if (!this.tableData[tableIndex].cache.responsible) {
                    this.cacheTable(table, tableIndex);
                }
        }
        // restore responsible table from cache if we have cached it
        else {
            node.outerHTML = cache.responsible;
            // TODO Do we need this node reference
            this.tableData[tableIndex].node = document.querySelector(this.options.tableSelector);
            this.tableData[tableIndex].isResponsible = true;
        }

        if (this.options.debug) {
            this.testData.finish = performance.now();
        }
    }

    /**
     * get table columns
     * @param table {Element}
     * @returns {array}
     */
    getColumns (table) {
        // potentially better way of getting this, maybe get largest row instead of assuming the first
        const firstRow = this.getRows(table)[0];
        return [].slice.call(firstRow.children);
    }

    /**
     * get table rows
     * @param table {Element}
     * @returns {array}
     */
     getRows (table) {
        return [].slice.call(table.getElementsByTagName('tr'));
    }

    /**
    * Get column headings
    * @param    {Element} table
    * @return   {Array} column headings
    **/
    getTableHeadings (table, index) {
        let headings = [];

        this.tableData[index].columns.nodes.forEach((column, index) => {
            headings.push(table.getElementsByTagName('th')[index].innerHTML);
        });

        return headings;
    }

    /**
     * build first row of responsible table
     * @param table {Element}
     * @param index {int}
     * @returns {String}
     */
    buildFirstRow (table, index) {
        // this might not be a th, fix that
        // maybe the plugin should not initiate if thr user hasn't used <th>'s
        const firstCell = table.querySelector('th');
        const firstRow = document.createElement('tr');
        const thisCell = document.createElement('th');

        // TODO: might be able to improve this with regex over dom nodes

        thisCell.innerHTML = firstCell.innerHTML;
        thisCell.setAttribute('colspan', 2);
        firstRow.appendChild(thisCell);

        return firstRow.innerHTML;
    }

    replaceTableHTML (table, index) {
        const { fragment } = this.tableData[index];
        const tbody = table.firstChild;

        // IF LEGEACY

        var temp = document.createElement('div');
        temp.innerHTML = `<table>${fragment}</table>` ;

        console.log(temp.innerHTML);

        tbody.parentNode.replaceChild(temp.firstChild, tbody);

        // ELSE

        // table.innerHTML = fragment;
    }

    /**
     * build table data
     * @param table {Element}
     * @param tableIndex {int}
     * @param rowIndex {int}
     * @returns {DocumentFragment}
     */
    buildTableData (table, tableIndex, rowIndex) {
        let fragment = '';
        let firstRow;
        const cells = this.tableData[tableIndex].rows.nodes[rowIndex].querySelectorAll('td');
        const firstCell = cells[0];
        // append first cell as data heading
        firstCell.setAttribute('colspan', 2);
        firstCell.classList.add(this.options.subHeadingClass);
        firstRow = `<tr>${firstCell.outerHTML}</tr>`;
        fragment += firstRow;

        // loop through each column excluding first and populate data
        this.tableData[tableIndex].columns.nodes.forEach((column, index) => {
            if (index) {
                let heading = `<td class="${this.options.columnHeadingClass}">${this.tableData[tableIndex].headings.titles[index]}</td>`;
                let row = `<tr>${heading.outerHTML}`;

                cells[index].classList.add(this.options.tableDataClass);
                row = `${cells[index].outerHTML}</tr>`;

                fragment += row;
            }
        });

        return fragment;
    }

    /**
     * toggle table state and restore
     * @param index {int || null}
     */
    restoreTable (index = null) {
        if (this.options.debug) {
            this.testData.start = performance.now();
        }

        // if no index provided restore all tables
        if (index === null) {
            this.originalTables.forEach((table, index) => {
                if (this.tableData[index].isResponsible) {
                    table.outerHTML = this.tableData[index].cache.original;
                    this.tableData[index].isResponsible = false;
                    // TODO: Do we need this new node reference?
                    this.tableData[index].node = [].slice.call(document.querySelectorAll(this.options.tableSelector))[index];
                }
                else {
                    table.outerHTML = this.tableData[index].cache.responsible;
                    this.tableData[index].isResponsible = true;
                    // TODO: Do we need this new node reference?
                    this.tableData[index].node = [].slice.call(document.querySelectorAll(this.options.tableSelector))[index];
                }
            });
        }
        // restore table index
        // TODO: perhaps need a method to return a table index,
        // how would a user know the table index?
        else {
            if (this.tableData[index].isResponsible) {
                this.tableData[index].isResponsible = false;
                this.tableData[index].node.outerHTML = this.tableData[index].cache.original;
                // TODO Do we need this node reference
                this.tableData[index].node = document.querySelector(this.options.tableSelector);
            }
            else {
                this.tableData[index].isResponsible = true;
                this.tableData[index].node.outerHTML = this.tableData[index].cache.responsible;
                // TODO Do we need this node reference
                this.tableData[index].node = document.querySelector(this.options.tableSelector);
            }
        }

        if (this.options.debug) {
            this.testData.finish = performance.now();
        }
    }


    /**
    * de-bounce and add window resize
    **/
    registerEvents () {
        window.addEventListener('resize', this.debounce(() => {
            this.refresh();
        }, this.options.debounceRate));
    }

    /**
    * event de-bounce taken from Underscore.js
    **/
    debounce (func, wait, immediate) {
        let timeout;
        return () => {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
}

module.exports = ResponsibleTables;
