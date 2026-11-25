# Purchase orders — what the new design needs from the backend

Frontend: `packages/frontend/src/pages/project/finances/purchase-orders-tab.tsx`
and `purchase-orders/`. The list, the New / Edit sheet, the PO detail sheet and
the Receive sheet are built to the new designs. A PO is a **record of an order
placed off-platform**; nothing here moves money.

## 1. Fields the design shows that the API does not carry (built, not sent)

The form holds these and validates nothing about them; they are dropped on save
until the API takes them.

| Where | Field | Needed |
|---|---|---|
| Line item (New / Edit) | **Unit** (a "Select type" dropdown) | `unit: string` on `PurchaseOrderItemInput` and `PurchaseOrderItem`. The sheet offers Bags, Tonnes, Kg, m, m², m³, Litres, Nr, Lot, Hours, Days — agree the list (or a project unit register) with product. |
| Line item (New / Edit) | **Add Image** | Per-line image attachments: a list of file ids (`imageFileIds`) via the files module. The detail and receive sheets show an attached file as a blue paperclip link with its file name, so the DTO needs the name or a resolvable file object. |
| PO (New / Edit) | **Add Image** under Notes | Order-level attachments (`attachmentFileIds`). |
| Receive sheet | **Notes (optional)** + **Add Image** | `note` already exists on the receive input; add `attachmentFileIds` to `ReceivePurchaseOrderInput`. |

Until then the detail sheet shows **Unit as "—"** for every line.

## 2. Decisions the design makes that need confirming

- **"Received now" is not in the Receive design.** The design lists the lines
  read-only, but the API records receipt per line (`lines[].receivedQuantity`), so
  the sheet adds a **Received now** input in the table's last column, pre-filled
  with the outstanding quantity. If receipt is meant to be all-or-nothing, say so
  and that column goes.
- **Stage vs Category.** The list header reads "Category" over a build-stage name
  ("Foundation"), while the form calls the same field "Stage". It is built as
  **Stage**. If POs get a real category, that needs a field.
- **"Committed / Not committed"** sub-line under Value is gone from the table (not
  in the design). Status carries it (a Draft is not committed) and the
  Committed spend card is the server's `committed` total.
- **Footer on the detail sheet** is `Cancel · Edit · <forward action>`. "Cancel"
  there is the PO **cancel** action (it asks for a reason), not "close the sheet".
- The Edit design's primary button reads "Add Purchase Order"; it is built as
  **Save Changes**.
- The design has no **Add line** control, so one was added at the right of the
  "Line Items" heading (and **Remove line** under any line when there is more than one).

## 3. List behaviour that is frontend-only today

- `GET /projects/:id/purchase-orders` returns every PO. Search (PO number, vendor,
  stage), the **Date** range (on the **expected** date; a PO with no expected date
  drops out while a range is set) and paging (10 per page) all run on the client.
  For long projects wanted: `search`, `expectedFrom` / `expectedTo`, `page`,
  `pageSize` and a `total`.
- The blue **download** icon builds a CSV in the browser from the filtered list
  (PO number, vendor, stage, status, dates, value, received). A server export, like
  `transactions/export.csv`, would let it cover the whole register.
- The three summary cards are derived on the client from the list: Committed
  (the server's `committed` flag), Open (Issued + Partially received) and Received
  value. The helper lines under Open POs and Received value are new copy (the design
  repeated another card's).
