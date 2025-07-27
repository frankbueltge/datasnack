# ☕ Caffeine Overload

This folder contains code and data for a Data Snack exploring worldwide coffee consumption trends.

## 🛒 Ingredients
- Dataset: [Worldwide Coffee Habits](https://www.kaggle.com/datasets/waqi786/worldwide-coffee-habits-dataset) on Kaggle
- Tools: Python, pandas, matplotlib, [kagglehub](https://github.com/Kaggle/kagglehub)

## 🍳 Output
- Bar chart of coffee consumption per capita by country

## 📁 Files
- `analysis.ipynb`: Minimal notebook to load and visualize the data

## 🔗 Blog post
👉 https://data-snack.com/caffeine-overload/

## 🖥️ Quickstart

Install the dataset loader:

```bash
pip install kagglehub[pandas-datasets]
```

Then run the notebook or the snippet below to load the data:

```python
import kagglehub
from kagglehub import KaggleDatasetAdapter

file_path = "coffee_consumption.csv"
df = kagglehub.load_dataset(
    KaggleDatasetAdapter.PANDAS,
    "waqi786/worldwide-coffee-habits-dataset",
    file_path,
)
print(df.head())
```
