from fastapi import FastAPI, HTTPException, UploadFile, File
from databases import Database
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import csv
import io
import openpyxl
import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

# Explicitly load .env file from the same directory as main.py
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise RuntimeError(
        "GOOGLE_API_KEY not found. Please ensure a .env file exists in the /server directory "
        "with the GOOGLE_API_KEY set."
    )

genai.configure(api_key=api_key)

DATABASE_URL = "sqlite:///./vinted.db"
database = Database(DATABASE_URL)

app = FastAPI()

class Item(BaseModel):
    id: Optional[int] = None
    name: str
    purchase_price: float = 0.0
    sell_price: Optional[float] = None
    sell_date: Optional[date] = None
    category: str
    status: str = 'listed'

class ItemCreate(BaseModel):
    name: str
    purchase_price: Optional[float] = 0.0
    category: str

class ItemUpdate(BaseModel):
    sell_price: float
    sell_date: date

class ItemEdit(BaseModel):
    name: Optional[str] = None
    purchase_price: Optional[float] = None
    category: Optional[str] = None
    sell_price: Optional[float] = None
    sell_date: Optional[date] = None

@app.on_event("startup")
async def startup():
    await database.connect()
    query = """
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        purchase_price REAL NOT NULL DEFAULT 0.0,
        sell_price REAL,
        sell_date TEXT,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'listed'
    )
    """
    await database.execute(query=query)

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/api/items", response_model=List[Item])
async def read_items():
    query = "SELECT * FROM items ORDER BY id DESC"
    return await database.fetch_all(query)

@app.post("/api/items", response_model=Item)
async def create_item(item: ItemCreate):
    query = "INSERT INTO items (name, purchase_price, category) VALUES (:name, :purchase_price, :category)"
    values = {"name": item.name, "purchase_price": item.purchase_price, "category": item.category}
    last_record_id = await database.execute(query, values)
    return {**item.dict(), "id": last_record_id, "status": "listed"}

@app.put("/api/items/{item_id}", response_model=Item)
async def update_item(item_id: int, item: ItemUpdate):
    query = "UPDATE items SET sell_price = :sell_price, sell_date = :sell_date, status = 'sold' WHERE id = :id"
    values = {"sell_price": item.sell_price, "sell_date": item.sell_date, "id": item_id}
    await database.execute(query, values)
    return await read_item(item_id)

@app.get("/api/items/{item_id}", response_model=Item)
async def read_item(item_id: int):
    query = "SELECT * FROM items WHERE id = :id"
    values = {"id": item_id}
    result = await database.fetch_one(query, values)
    if result is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return result

@app.delete("/api/items/{item_id}", status_code=204)
async def delete_item(item_id: int):
    query = "DELETE FROM items WHERE id = :id"
    values = {"id": item_id}
    result = await database.execute(query, values)
    if result == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return

@app.patch("/api/items/{item_id}", response_model=Item)
async def edit_item(item_id: int, item: ItemEdit):
    # Fetch existing item
    existing_item = await read_item(item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Create a dictionary of the fields to update
    update_data = item.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Build the SET part of the SQL query
    set_clause = ", ".join(f"{key} = :{key}" for key in update_data.keys())
    
    query = f"UPDATE items SET {set_clause} WHERE id = :id"
    values = {**update_data, "id": item_id}
    
    await database.execute(query, values)
    return await read_item(item_id)

class ProfitByCategory(BaseModel):
    category: str
    total_profit: float
    items_sold: int
    total_revenue: float
    average_profit: float

@app.get("/api/analysis", response_model=List[ProfitByCategory])
async def get_analysis():
    query = """
        SELECT 
            category, 
            SUM(sell_price - purchase_price) as total_profit,
            COUNT(id) as items_sold,
            SUM(sell_price) as total_revenue,
            AVG(sell_price - purchase_price) as average_profit
        FROM items
        WHERE status = 'sold'
        GROUP BY category
    """
    return await database.fetch_all(query)

async def get_categories_for_batch(product_names: List[str], existing_categories: List[str]) -> dict:
    categories_str = ", ".join(f'"{cat}"' for cat in existing_categories)
    products_str = "\n".join(f'- "{name}"' for name in product_names)

    prompt = f"""
    You are an expert in product categorization.
    Your task is to assign a category to each product in the following list.
    
    Product List:
    {products_str}

    Existing Categories:
    [{categories_str}]

    Please return a single JSON object where each key is a product name from the list and the value is its assigned category.
    - First, try to use one of the existing categories if it's a good fit.
    - If no existing category fits, create a new, relevant category.
    - The entire response must be a single, valid JSON object.

    Example response format:
    {{
      "iPhone 13 Pro Max": "Smartfony",
      "Nike Air Max 90": "Buty sportowe",
      "Kurtka zimowa The North Face": "Odzież zimowa"
    }}
    """
    try:
        model = genai.GenerativeModel('gemini-2.5-pro')
        response = model.generate_content(prompt)
        
        # Clean the response to ensure it's valid JSON
        mapping_str = response.text.strip()
        if mapping_str.startswith("```json"):
            mapping_str = mapping_str[7:-4].strip()
        
        return json.loads(mapping_str)
    except Exception as e:
        print(f"AI Batch Category Generation Error: {e}")
        # Return an empty dict on failure, so items get a default category
        return {}

async def get_column_mapping_from_ai(headers: List[str], data_sample: List[List[str]]):
    TARGET_COLUMNS = ["name", "purchase_price", "category", "sell_price", "sell_date"]
    
    prompt = f"""
    You are an intelligent assistant that helps map CSV/Excel columns to a database schema.
    Given the following headers from an uploaded file and a sample of the data, please provide a JSON object that maps the file's headers to the target database columns.

    File Headers: {headers}
    Data Sample:
    {data_sample}

    Target Database Columns: {TARGET_COLUMNS}

    Map the file headers to the target columns. The JSON keys should be the headers from the file, and the values should be the corresponding target column name.
    If a header from the file does not map to any target column, you can omit it or map it to null.
    If a target column is not present in the file, it should be omitted from the JSON values.
    Your response must be a valid JSON object only, without any markdown formatting like ```json ... ```.

    Example response for a similar task:
    {{
      "Product Name": "name",
      "Buy Price": "purchase_price",
      "Type": "category",
      "Some Other Column": null
    }}
    """
    
    try:
        model = genai.GenerativeModel('gemini-2.5-pro')
        response = model.generate_content(prompt)
        
        # Clean the response to ensure it's valid JSON
        mapping_str = response.text.strip()
        if mapping_str.startswith("```json"):
            mapping_str = mapping_str[7:-4].strip()
        
        return json.loads(mapping_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get mapping from AI: {e}")

@app.post("/api/import", status_code=201)
async def import_items(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV or XLSX file.")

    contents = await file.read()
    headers = []
    data = []
    
    try:
        if file.filename.endswith('.csv'):
            stream = io.StringIO(contents.decode("utf-8"))
            reader = csv.reader(stream)
            headers = next(reader)
            data = [row for row in reader if any(row)]
        
        elif file.filename.endswith('.xlsx'):
            workbook = openpyxl.load_workbook(io.BytesIO(contents))
            sheet = workbook.active
            headers = [cell.value for cell in sheet[1]]
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not any(row): continue
                data.append(list(row))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {e}")

    if not headers or not data:
        raise HTTPException(status_code=400, detail="File is empty or has no data.")

    # Fetch existing categories to help AI
    query = "SELECT DISTINCT category FROM items"
    existing_categories_records = await database.fetch_all(query)
    existing_categories = [record['category'] for record in existing_categories_records]

    # Fetch existing item names to prevent duplicates
    query = "SELECT name FROM items"
    existing_items_records = await database.fetch_all(query)
    existing_item_names = {record['name'] for record in existing_items_records}

    data_sample = data[:5] # Use first 5 rows as a sample
    column_mapping = await get_column_mapping_from_ai(headers, data_sample)

    # Invert mapping for easier lookup: { "target_column": "file_header" }
    inverted_mapping = {v: k for k, v in column_mapping.items() if v}

    # Validate that all required columns are mapped
    required_columns = ["name", "purchase_price"]
    if not all(col in inverted_mapping for col in required_columns):
        missing = [col for col in required_columns if col not in inverted_mapping]
        raise HTTPException(status_code=400, detail=f"AI could not map the following required columns: {missing}. Please check the file.")

    category_map = {}
    # If category column is not in the file, generate categories in one batch
    if not inverted_mapping.get("category"):
        # Use a set to get unique product names for efficiency
        product_names = set(dict(zip(headers, row)).get(inverted_mapping.get("name")) for row in data)
        # Filter out any potential None values
        valid_product_names = [name for name in product_names if name]
        if valid_product_names:
            category_map = await get_categories_for_batch(valid_product_names, existing_categories)

    items_to_insert = []
    newly_added_names = set()
    for row in data:
        row_dict = dict(zip(headers, row))
        try:
            name = row_dict.get(inverted_mapping.get("name"))
            purchase_price_str = row_dict.get(inverted_mapping.get("purchase_price"))

            # Skip row if name is missing
            if not name:
                continue

            # Skip if item name already exists in the database or in the current batch
            if name in existing_item_names or name in newly_added_names:
                continue
            
            purchase_price = 0.0
            if purchase_price_str and str(purchase_price_str).strip():
                try:
                    purchase_price = float(purchase_price_str)
                except (ValueError, TypeError):
                    # If conversion fails, skip the row
                    print(f"Skipping row due to invalid purchase price: {row}")
                    continue
            
            category = "Inne" # Default category
            # Case 1: Category column exists in the file
            if inverted_mapping.get("category"):
                category_from_file = row_dict.get(inverted_mapping.get("category"))
                if category_from_file:
                    category = category_from_file
            # Case 2: Category was batch-generated by AI
            elif name in category_map:
                category = category_map[name]

            item_data = {
                "name": name,
                "purchase_price": purchase_price,
                "category": category,
                "sell_price": float(row_dict[inverted_mapping["sell_price"]]) if inverted_mapping.get("sell_price") and row_dict.get(inverted_mapping.get("sell_price")) else None,
                "sell_date": row_dict.get(inverted_mapping.get("sell_date")) or None,
                "status": "listed"
            }

            # Update status to 'sold' if sell_price or sell_date is present
            if item_data["sell_price"] is not None or item_data["sell_date"] is not None:
                item_data["status"] = "sold"

            items_to_insert.append(item_data)
            newly_added_names.add(name)
        except (KeyError, ValueError, TypeError) as e:
            print(f"Skipping row due to data error: {row} - {e}")
            continue

    if not items_to_insert:
        raise HTTPException(status_code=400, detail="No valid items could be processed from the file.")

    async with database.transaction():
        for item in items_to_insert:
            query = """
                INSERT INTO items (name, purchase_price, category, sell_price, sell_date, status) 
                VALUES (:name, :purchase_price, :category, :sell_price, :sell_date, :status)
            """
            await database.execute(query, item)

    return {"message": f"Successfully imported {len(items_to_insert)} items."}
