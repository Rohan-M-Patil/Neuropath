import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface MindMapData {
  nodes: { id: string; label: string; group: number }[]
  links: { source: string; target: string }[]
}

const GROUP_COLORS = ['#7C9CFF', '#FF7A45', '#4ADE80', '#FFC95C', '#C084FC']

export default function MindMapRadial({ data }: { data: MindMapData }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return

    const width = svgRef.current.clientWidth || 800
    const height = 560

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 2.5])
        .on('zoom', (event) => g.attr('transform', `translate(${width / 2},${height / 2}) ${event.transform}`)) as any
    )

    const simulation = d3
      .forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links as any).id((d: any) => d.id).distance(100).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide(36))

    const link = g
      .append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#2A3548')
      .attr('stroke-width', 1.5)

    const node = g
      .append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .call(
        d3.drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }) as any
      )

    node
      .append('circle')
      .attr('r', (d: any) => 14 + d.group * 2)
      .attr('fill', (d: any) => GROUP_COLORS[(d.group - 1) % GROUP_COLORS.length])
      .attr('opacity', 0.85)

    node
      .append('text')
      .text((d: any) => (d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label))
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => 14 + d.group * 2 + 14)
      .attr('fill', '#E8ECF4')
      .attr('font-size', 11)
      .style('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [data])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={560}
      className="rounded-xl border border-white/5 bg-synapse/40"
    />
  )
}
