const SHOPIFY_STORE = '046318-dd.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const API_VERSION = '2026-01';

interface ShopifyLineItem {
	product_id: number;
	title: string;
}

interface ShopifyOrder {
	id: number;
	name: string;
	email: string;
	created_at: string;
	line_items: ShopifyLineItem[];
}

export async function fetchOrdersByEmail(email: string): Promise<ShopifyOrder[]> {
	if (!SHOPIFY_TOKEN) return [];

	try {
		const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/orders.json?email=${encodeURIComponent(email)}&status=any&limit=250&fields=id,name,email,created_at,line_items`;
		const res = await fetch(url, {
			headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
		});

		if (!res.ok) return [];

		const data = await res.json();
		return data.orders || [];
	} catch {
		return [];
	}
}

export function extractProductTitles(orders: ShopifyOrder[]): string[] {
	const titles = new Set<string>();
	for (const order of orders) {
		for (const item of order.line_items) {
			titles.add(item.title);
		}
	}
	return [...titles];
}
