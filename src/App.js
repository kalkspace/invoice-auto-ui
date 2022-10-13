import styles from "./App.module.css";
import { useState, useCallback, useMemo } from "react";

class ApiClient {
  constructor(email, apiKey) {
    this.email = email;
    this.apiKey = apiKey;
  }

  async fetch(service, params) {
    const req = {
      SERVICE: service,
      ...params,
    };
    const resp = await fetch("https://my.fastbill.com/api/1.0/api.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${this.email}:${this.apiKey}`, "utf-8")}`,
      },
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      throw new Error(`Invalid status: ${resp.status}`);
    }

    const data = await resp.json();

    if (data?.RESPONSE?.ERRORS) {
      throw new Error(
        `Failed to send request: ${data?.RESPONSE?.ERRORS.join(" | ")}`
      );
    }
    return data?.RESPONSE;
  }

  async getInvoices(filter) {
    const resp = await this.fetch("invoice.get", {
      FILTER: filter,
    });
    return resp?.INVOICES;
  }

  /**
   *
   * @param {string} id
   * @param {Partial<Invoice>} update
   */
  async updateInvoice(id, update) {
    const resp = await this.fetch("invoice.update", {
      DATA: {
        INVOICE_ID: id,
        ...update,
      },
    });
    if (resp?.STATUS !== "success") {
      throw new Error("Failed to update");
    }
  }

  async completeInvoice(id) {
    const resp = await this.fetch("invoice.complete", {
      DATA: {
        INVOICE_ID: id,
      },
    });
    if (resp?.STATUS !== "success") {
      throw new Error("Failed to update");
    }
    return resp;
  }

  async sendInvoiceEmail(id, to, date) {
    const resp = await this.fetch("invoice.sendbyemail", {
      DATA: {
        INVOICE_ID: id,
        RECIPIENT: {
          TO: to,
        },
        SUBJECT: `KalkSpace Coworking Beitrag ${date.toLocaleDateString(
          "de-DE",
          { month: "long" }
        )}`,
        MESSAGE: `Hallo!

        Anbei findest du deine Beitragsrechnung für den vorherigen Monat.

        Vielen Dank und liebe Grüße!`,
      },
    });
    if (resp?.STATUS !== "success") {
      throw new Error("Failed to update");
    }
    return resp?.STATUS;
  }

  async getCustomer(id) {
    const resp = await this.fetch("customer.get", {
      FILTER: {
        CUSTOMER_ID: id,
      },
    });
    return resp?.CUSTOMERS[0];
  }
}

/** @typedef {{
  TYPE: string;
  INVOICE_ID: string;
  CUSTOMER_ID: string;
  CUSTOMER_NUMBER: string;
  CUSTOMER_COSTCENTER_ID: string;
  ORGANIZATION: string;
  SALUTATION: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  ADDRESS: string;
  ADDRESS_2: string;
  ZIPCODE: string;
  CITY: string;
  COMMENT_: string;
  PAYMENT_TYPE: string;
  DAYS_FOR_PAYMENT: string;
  BANK_NAME: string;
  BANK_ACCOUNT_NUMBER: string;
  BANK_CODE: string;
  BANK_ACCOUNT_OWNER: string;
  BANK_IBAN: string;
  BANK_BIC: string;
  AFFILIATE: string;
  COUNTRY_CODE: string;
  VAT_ID: string;
  CURRENCY_CODE: string;
  TEMPLATE_ID: string;
  CONTACT_ID: string;
  SUBSCRIPTION_ID: string;
  INVOICE_NUMBER: string;
  INVOICE_TITLE: string;
  INTROTEXT: string;
  PAID_DATE: string;
  IS_CANCELED: string;
  INVOICE_DATE: string;
  DUE_DATE: string;
  DELIVERY_DATE: string;
  SERVICE_PERIOD_START: string;
  SERVICE_PERIOD_END: string;
  CASH_DISCOUNT_PERCENT: string;
  CASH_DISCOUNT_DAYS: string;
  SUB_TOTAL: number;
  VAT_TOTAL: number;
  VAT_ITEMS: unknown[];
  ITEMS: unknown[];
  TOTAL: number;
  PAYMENTS: unknown[];
  PAYMENT_INFO: string;
  DOCUMENT_URL: string;
}} Invoice */

function App() {
  const [mail, setMail] = useState("vorstand@kalk.space");
  const [apiKey, setApiKey] = useState("");
  const client = useMemo(() => new ApiClient(mail, apiKey), [mail, apiKey]);
  /** @type {[Invoice[], React.Dispatch<React.SetStateAction>]} */
  const [invoices, setInvoices] = useState([]);

  const fetchData = useCallback(async () => {
    const invoices = await client.getInvoices({
      TYPE: "draft",
    });
    setInvoices(invoices);
  }, [client]);

  const sendInvoices = useCallback(async () => {
    try {
      for (const invoice of invoices) {
        await client.updateInvoice(invoice.INVOICE_ID, {
          INVOICE_DATE: new Date().toISOString().slice(0, 10),
        });
        await client.completeInvoice(invoice.INVOICE_ID);
        const [customer, invoices] = await Promise.all([
          client.getCustomer(invoice.CUSTOMER_ID),
          client.getInvoices({ INVOICE_ID: invoice.INVOICE_ID }),
        ]);
        const serviceStart = new Date(invoices[0].SERVICE_PERIOD_START);
        await client.sendInvoiceEmail(
          invoice.INVOICE_ID,
          customer.EMAIL,
          serviceStart
        );
      }
    } catch (e) {
      alert(e);
    }
  }, [client, invoices]);

  return (
    <div>
      <div className={styles.inputs}>
        <input
          type="text"
          placeholder="mail"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
        />
        <input
          type="text"
          placeholder="api key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button onClick={fetchData}>Fetch!</button>
      </div>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <td>Name</td>
              <td>Datum</td>
              <td>Betrag</td>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr>
                <td>
                  {i.FIRST_NAME} {i.LAST_NAME}
                </td>
                <td>{i.INVOICE_DATE}</td>
                <td>{i.TOTAL}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={sendInvoices}>Und los!</button>
    </div>
  );
}

export default App;
