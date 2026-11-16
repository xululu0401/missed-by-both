# 两遍都没看见

两个人各查一遍错，把两张勘误单贴进来，从两人都找到的重合估出两人都没看见的大概还剩几处、几成把握不超过几处、还要再查几遍。

- 体验：https://xululu0401.github.io/missed-by-both/
- 计算：`core.js`（两样本标记重捕：超几何似然 × 1/N 先验的后验分布；Chapman 公式作对照）
- 测试：`node --test tests/core.test.cjs`；独立参考实现 `python3 tests/ref.py` 生成 `tests/ref.json`（300 组）；注入测试 `node tests/inject.cjs`
- 假设：两人各查各的、每处错一样好找、查的时候稿子没改。默认数字和勘误内容为虚构示例。
