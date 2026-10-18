// Built-in message templates. Words in {curly braces} become fill-in fields.
export const TEMPLATES = [
  {
    id: 'rfq', title: 'Request for quotation', category: 'Sourcing',
    en: `Dear {contact},

We are {company}, a consumer electronics brand selling in {market}. We are sourcing {product} and would like your best offer for:

- Specification: {specs}
- Quantity: {qty} pcs (first order), with expected repeat orders
- Terms: {incoterm}, please also state payment terms
- Packaging: {packaging}

Please include unit price, MOQ, production lead time, sample cost and lead time, warranty and available certifications (CE / RoHS / others).

We are comparing offers until {deadline}.

Best regards,
{name}
{company}`,
    cn: `{contact} 您好，

我们是 {company}，一家在 {market} 销售的消费电子品牌。我们正在采购 {product}，想请贵司就以下需求提供最优报价：

- 规格：{specs}
- 数量：首单 {qty} 台，后续会有返单
- 贸易条款：{incoterm}，请同时注明付款方式
- 包装：{packaging}

请在报价中注明单价、起订量（MOQ）、生产交期、样品费用及样品交期、质保，以及可提供的认证（CE / RoHS 等）。

我们会在 {deadline} 前完成比价。

谢谢！
{name}
{company}`
  },
  {
    id: 'price-follow', title: 'Follow up on a quotation', category: 'Sourcing',
    en: `Hi {contact},

Hope you are well. Following up on our request for {product}. Could you please share your quotation by {deadline}? If any detail is unclear, I am happy to clarify.

Thank you,
{name}`,
    cn: `{contact} 您好，

关于 {product} 的询价，想跟进一下报价进度。请问能否在 {deadline} 前发给我们？如果有任何细节不清楚，欢迎随时问我。

谢谢！
{name}`
  },
  {
    id: 'negotiate', title: 'Ask for a better price', category: 'Negotiation',
    en: `Hi {contact},

Thank you for the quotation for {product}. Your offer is competitive on quality, but the price is above our target. We have other offers around {target} per unit.

If you can reach {target} for {qty} pcs, we can confirm the order this month and plan regular repeat orders. Could you also check whether a longer lead time or simpler packaging would help reduce cost?

Looking forward to your reply.
{name}`,
    cn: `{contact} 您好，

感谢贵司 {product} 的报价。贵司产品质量很有竞争力，但价格高于我们的目标价。我们目前收到的其他报价在每台 {target} 左右。

如果贵司 {qty} 台能做到 {target}，我们本月即可下单，并计划后续稳定返单。另外也请帮忙确认：如果交期放宽或简化包装，是否可以进一步降低成本？

期待您的回复。
{name}`
  },
  {
    id: 'sample', title: 'Request samples', category: 'Samples',
    en: `Hi {contact},

We would like to evaluate {product} before placing an order. Please send {qty} sample(s) to:

{address}

Please confirm the sample cost, courier cost and tracking number once shipped. If the sample cost can be refunded against the first order, please let me know.

Thank you,
{name}`,
    cn: `{contact} 您好，

下单前我们需要先评估 {product}，请寄 {qty} 个样品到以下地址：

{address}

请确认样品费和快递费，寄出后请提供快递单号。如果样品费可以在首单中抵扣，也请告知。

谢谢！
{name}`
  },
  {
    id: 'lead-time', title: 'Confirm production and shipping dates', category: 'Orders',
    en: `Hi {contact},

Could you please confirm the current production status of PO {po} ({product}, {qty} pcs)?

1. Expected production completion date
2. Expected loading / ETD date
3. Any risk of delay we should know about

Thank you,
{name}`,
    cn: `{contact} 您好，

麻烦确认一下订单 {po}（{product}，{qty} 台）的生产进度：

1. 预计生产完成日期
2. 预计装柜 / 出货（ETD）日期
3. 是否有任何可能延误的风险

谢谢！
{name}`
  },
  {
    id: 'cny', title: 'Chinese New Year planning', category: 'Orders',
    en: `Hi {contact},

As Chinese New Year approaches, we want to plan ahead. Could you please share:

1. Your factory holiday dates (closing and reopening)
2. The last order date to ship before the holiday
3. Your capacity for {product} in the weeks before the holiday

We are considering an order of {qty} pcs.

Thank you,
{name}`,
    cn: `{contact} 您好，

春节快到了，我们想提前做好安排。请告知：

1. 工厂放假和复工日期
2. 节前能出货的最晚下单日期
3. 节前几周 {product} 的产能情况

我们计划下单 {qty} 台。

谢谢！提前祝您新年快乐！
{name}`
  },
  {
    id: 'quality', title: 'Report a quality issue', category: 'Quality',
    en: `Hi {contact},

We found an issue with {product} from PO {po}: {issue}.

Affected quantity: {qty} pcs. Photos and videos are attached.

Please investigate the root cause and propose a solution (replacement, credit note or repair) by {deadline}. Please also share the corrective action to prevent this in the next production.

Thank you,
{name}`,
    cn: `{contact} 您好，

我们发现订单 {po} 的 {product} 存在以下问题：{issue}。

受影响数量：{qty} 台，相关照片和视频请见附件。

请在 {deadline} 前分析原因并给出解决方案（补货、退款或维修），同时请提供纠正措施，避免下一批生产出现同样问题。

谢谢！
{name}`
  },
  {
    id: 'docs', title: 'Ask for shipping documents', category: 'Orders',
    en: `Hi {contact},

For PO {po}, please send the draft documents for our review before shipment:

- Commercial invoice
- Packing list
- Bill of lading draft
- Certificate of origin

Please make sure our ACID number {acid} appears on the invoice and B/L.

Thank you,
{name}`,
    cn: `{contact} 您好，

订单 {po} 出货前，请先发以下单据草稿给我们确认：

- 商业发票
- 装箱单
- 提单草稿
- 原产地证

请确保我们的 ACID 编号 {acid} 显示在发票和提单上。

谢谢！
{name}`
  },
  {
    id: 'intro', title: 'Introduce yourself to a supplier', category: 'Relationship',
    en: `Dear {contact},

My name is {name} and I recently joined {company} as Supplier & Business Development Executive. I will be your main contact for sourcing and new product topics from now on.

I look forward to working closely with you. Could we schedule a short call this week to go over current projects and your latest products?

Best regards,
{name}`,
    cn: `{contact} 您好，

我是 {name}，最近加入 {company}，担任供应商与业务发展专员。今后采购和新品相关的事宜将由我负责对接。

很期待与您密切合作。请问本周是否方便安排一个简短的电话，一起过一下目前的项目和贵司的新品？

此致敬礼
{name}`
  }
];
