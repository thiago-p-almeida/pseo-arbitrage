import asyncio
import aiohttp
import os
import random
import json
import argparse
import sys

# Configurações de Resiliência (Exponential Backoff + Jitter)
INITIAL_DELAY = 1.0  # 1 segundo inicial
MAX_RETRIES = 4
BASE_BACKOFF = 2.0

async def fetch_with_backoff(session, url, headers=None):
    """
    Realiza requisições HTTP assíncronas implementando Exponential Backoff + Jitter.
    Bypassa HTTP 429 e previne o banimento do IP do GitHub Actions por APIs de afiliados.
    """
    delay = INITIAL_DELAY
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, headers=headers, timeout=10) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 429:  # Rate Limit Atingido
                    print(f"[RATE LIMIT] 429 em {url}. Tentativa {attempt + 1}/{MAX_RETRIES}")
                else:
                    print(f"[HTTP {response.status}] ao consultar {url}")
        except Exception as e:
            print(f"[ERRO] {e} na tentativa {attempt + 1}/{MAX_RETRIES}")

        # Cálculo do Backoff Exponencial + Jitter aleatório (entre 0 e 500ms)
        jitter = random.uniform(0.0, 0.5)
        sleep_time = (delay * (BASE_BACKOFF ** attempt)) + jitter
        print(f"Aguardando {sleep_time:.2f}s antes da próxima tentativa...")
        await asyncio.sleep(sleep_time)

    return None

async def process_product(session, product_id, category, tier):
    """
    Simula a atualização de preços e ofertas para um produto individual
    """
    # Exemplo mock de chamada para API de Afiliados (Amazon/ML)
    fake_url = f"https://httpbin.org/json" 
    data = await fetch_with_backoff(session, fake_url)

    if data:
        # Lógica de montagem das ofertas e atualização no D1
        lowest_price = round(random.uniform(50.0, 500.0), 2)
        offers = [
            {"store": "Amazon", "price": lowest_price, "url": f"https://amazon.com.br/dp/{product_id}?tag=meusite-20"},
            {"store": "Mercado Livre", "price": lowest_price * 1.05, "url": f"https://mercadolivre.com.br/p/{product_id}"}
        ]
        
        return {
            "id": product_id,
            "lowest_price": lowest_price,
            "offers_json": json.dumps(offers),
            "traffic_tier": tier
        }
    return None

async def main(tier):
    print(f"=== INICIANDO ETL PARA CURVA TIER '{tier}' ===")
    
    # 1. Conecta ao Cloudflare D1 via Wrangler CLI ou API REST para buscar produtos do Tier especificado
    # Em ambiente CI, executamos em lote (Batch)
    print(f"Buscando SKUs do Tier {tier} no D1...")
    
    # Exemplo de produtos mock do lote
    mock_skus = [f"SKU-{tier}-{i}" for i in range(1, 11)]

    async with aiohttp.ClientSession() as session:
        tasks = [process_product(session, sku, "pecas", tier) for sku in mock_skus]
        results = await asyncio.gather(*tasks)

    valid_results = [r for r in results if r is not None]
    print(f"Sucesso! {len(valid_results)} produtos processados com resiliência.")

    # 2. Gera comandos de SQL Batch Update para inserção eficiente no D1 (Regra Seção 2.3)
    if valid_results:
        sql_statements = []
        for item in valid_results:
            sql = f"UPDATE products SET lowest_price = {item['lowest_price']}, offers_json = '{item['offers_json']}', updated_at = CURRENT_TIMESTAMP WHERE id = '{item['id']}';"
            sql_statements.append(sql)
        
        # Salva o lote SQL em arquivo para execução pelo Wrangler no GitHub Actions
        with open("batch_update.sql", "w") as f:
            f.write("\n".join(sql_statements))
        print("Arquivo 'batch_update.sql' gerado com sucesso para o Wrangler.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETL Assíncrono com Resiliência para pSEO")
    parser.add_argument("--tier", choices=["A", "B", "C"], default="A", help="Tier da Curva ABC")
    args = parser.parse_args()

    asyncio.run(main(args.tier))