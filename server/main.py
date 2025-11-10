from fastapi import FastAPI, HTTPException, UploadFile, File
from databases import Database
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import csv
import io
import openpyxl

DATABASE_URL = "sqlite:///./vinted.db"
database = Database(DATABASE_URL)

app = FastAPI()

class Item(BaseModel):
    id: Optional[int] = None
    name: str
    purchase_price: float
    sell_price: Optional[float] = None
    sell_date: Optional[date] = None
    category: str
    status: str = 'listed'

class ItemCreate(BaseModel):
    name: str
    purchase_price: float
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
        purchase_price REAL NOT NULL,
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

@app.get("/api/analysis", response_model=List[ProfitByCategory])
async def get_analysis():
    query = """
        SELECT category, SUM(sell_price - purchase_price) as total_profit
        FROM items
        WHERE status = 'sold'
        GROUP BY category
    """
    return await database.fetch_all(query)

@app.post("/api/import", status_code=201)
async def import_items(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV or XLSX file.")

    items_to_create = []
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            stream = io.StringIO(contents.decode("utf-8"))
            reader = csv.reader(stream)
            next(reader)  # Skip header row
            for row in reader:
                if not row: continue
                items_to_create.append(ItemCreate(name=row[0], purchase_price=float(row[1]), category=row[2]))
        
        elif file.filename.endswith('.xlsx'):
            workbook = openpyxl.load_workbook(io.BytesIO(contents))
            sheet = workbook.active
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not any(row): continue
                items_to_create.append(ItemCreate(name=row[0], purchase_price=float(row[1]), category=row[2]))

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {e}")

    if not items_to_create:
        raise HTTPException(status_code=400, detail="No items found in the file.")

    async with database.transaction():
        for item in items_to_create:
            query = "INSERT INTO items (name, purchase_price, category) VALUES (:name, :purchase_price, :category)"
            values = {"name": item.name, "purchase_price": item.purchase_price, "category": item.category}
            await database.execute(query, values)

    return {"message": f"Successfully imported {len(items_to_create)} items."}
