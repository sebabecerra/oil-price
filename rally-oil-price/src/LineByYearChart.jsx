import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import { GridComponent, MarkPointComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";

use([CanvasRenderer, LineChart, GridComponent, MarkPointComponent, TooltipComponent]);

function formatPrice(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatHoverDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function buildSeriesConfig({ dataset, accent, labels, fullDataBySeries, currentYear }) {
  const highlightedYears = new Map([[1999, "rgba(255,255,255,0.22)"], [2020, "rgba(255,255,255,0.22)"], [currentYear, accent]]);

  return dataset.series.map((entry, index) => {
    const isCurrent = entry.year === currentYear;
    const isHighlighted = highlightedYears.has(entry.year);
    const color = highlightedYears.get(entry.year) ?? "rgba(255,255,255,0.22)";
    const labelColor = entry.year === 1999 || entry.year === 2020 ? "rgba(255,255,255,0.5)" : color;
    const fullData = fullDataBySeries[index] ?? [];
    const minPoint = entry.year === 2020 && fullData.length
      ? fullData.reduce((lowest, point) => (point[1] < lowest[1] ? point : lowest), fullData[0])
      : null;

    return {
      name: String(entry.year),
      type: "line",
      showSymbol: false,
      smooth: false,
      z: isCurrent ? 10 : 2,
      lineStyle: { color, width: isCurrent ? 3.25 : 1.1 },
      emphasis: {
        focus: "series",
        lineStyle: { width: isCurrent ? 4 : 2 },
      },
      endLabel: isHighlighted && entry.year !== 2020 ? {
        show: true,
        formatter: `{a}`,
        color: labelColor,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 14,
        fontWeight: isCurrent ? 700 : 600,
      } : undefined,
      labelLayout: isHighlighted && entry.year !== 2020 ? { moveOverlap: 'shiftY' } : undefined,
      markPoint: entry.year === 2020 && minPoint ? {
        symbol: 'circle',
        symbolSize: 1,
        tooltip: { show: false },
        label: {
          show: true,
          formatter: '2020',
          color: labelColor,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 14,
          fontWeight: 600,
          offset: [0, 12],
        },
        itemStyle: { color: 'transparent' },
        data: [{ coord: [minPoint[0], minPoint[1]] }],
      } : undefined,
      data: fullData,
    };
  });
}

const LineByYearChart = forwardRef(function LineByYearChart({ dataset, accent, animationKey, labels }, forwardedRef) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useImperativeHandle(forwardedRef, () => ({
    downloadPng(filename = "rally-oil-price.png") {
      if (!chartRef.current) return;
      const url = chartRef.current.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#050505",
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    getPngDataUrl() {
      if (!chartRef.current) return null;
      const currentYear = dataset.summary.currentYear;
      const fullDataBySeries = dataset.series.map((entry) =>
        entry.points.map((point) => [point.day, point.changePct, point.date, point.price]),
      );
      chartRef.current.setOption({
        animation: false,
        series: buildSeriesConfig({ dataset, accent, labels, fullDataBySeries, currentYear }),
      });
      chartRef.current.resize();
      return chartRef.current.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#050505",
      });
    },
  }), []);

  useEffect(() => {
    if (!ref.current) return;

    const chart = init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const currentYear = dataset.summary.currentYear;
    const currentSeriesIndex = dataset.series.findIndex((entry) => entry.year === currentYear);
    let lastMouseY = 0;
    let animationFrame = 0;
    let animationTimeout;

    const allSeriesData = dataset.series.map((entry) =>
      entry.points.map((point) => [point.day, point.changePct, point.date, point.price]),
    );

    chart.setOption({
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 62, right: 34, top: 32, bottom: 54 },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          snap: false,
          lineStyle: {
            color: "rgba(255,255,255,0.16)",
            width: 1,
          },
        },
        backgroundColor: "rgba(10, 10, 12, 0.98)",
        borderColor: "rgba(255,255,255,0.18)",
        textStyle: { color: "#f4f4f4", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10 },
        formatter: (params) => {
          const items = params;
          if (!items.length) return "";

          let best = items[0];
          let bestDistance = Number.POSITIVE_INFINITY;

          for (const item of items) {
            const [day, change] = item.data;
            const [, py] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [day, change]);
            const distance = Math.abs(py - lastMouseY);
            if (distance < bestDistance) {
              best = item;
              bestDistance = distance;
            }
          }

          const [, changePct, date, price] = best.data;
          return [
            `<strong>${best.seriesName}</strong>`,
            `${formatHoverDate(date)}`,
            `${labels.valueLabel} ${formatPrice(price)}`,
            `${labels.changeLabel} ${changePct.toFixed(2)}%`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.max(...dataset.series.map((item) => item.points.length)),
        interval: 50,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.42)" } },
        axisLabel: {
          color: "rgba(242, 242, 242, 0.9)",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 17,
          fontWeight: 600,
          formatter: (value) => (value > 0 && value % 50 === 0 ? `${value}` : ""),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.42)" } },
        axisLabel: {
          color: "rgba(242, 242, 242, 0.9)",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 17,
          fontWeight: 600,
          formatter: (value) => `${value}`,
        },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.09)" } },
      },
      series: buildSeriesConfig({ dataset, accent, labels, fullDataBySeries: allSeriesData, currentYear }).map((entry) => (
        entry.name === String(currentYear)
          ? { ...entry, data: entry.data.slice(0, 1) }
          : entry
      )),
    });

    if (currentSeriesIndex >= 0) {
      const currentData = allSeriesData[currentSeriesIndex];
      const totalPoints = currentData.length;
      const start = performance.now();
      const duration = 1800;

      const animateCurrentSeries = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const visiblePoints = Math.max(1, Math.ceil(progress * totalPoints));

        chart.setOption({
          series: dataset.series.map((entry, index) => (
            index === currentSeriesIndex
              ? { name: String(entry.year), data: currentData.slice(0, visiblePoints) }
              : { name: String(entry.year) }
          )),
        });

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animateCurrentSeries);
        }
      };

      animationTimeout = window.setTimeout(() => {
        animationFrame = window.requestAnimationFrame(animateCurrentSeries);
      }, 80);
    }

    const zr = chart.getZr();
    const handleMouseMove = (event) => {
      lastMouseY = event.offsetY;
    };
    zr.on("mousemove", handleMouseMove);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(ref.current);

    return () => {
      if (animationTimeout) window.clearTimeout(animationTimeout);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      zr.off("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      chartRef.current = null;
      chart.dispose();
    };
  }, [accent, animationKey, dataset, labels]);

  return <div className="chart-canvas" ref={ref} />;
});

export default LineByYearChart;
