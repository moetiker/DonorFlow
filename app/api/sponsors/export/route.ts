import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildCSV } from '@/lib/csv'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all sponsors with related data
    const sponsors = await prisma.sponsor.findMany({
      orderBy: { lastName: 'asc' },
      include: {
        member: true,
        group: true,
        donations: {
          select: {
            amount: true,
            donationDate: true
          }
        }
      }
    })

    // CSV Headers (German)
    const headers = [
      'Firma',
      'Anrede',
      'Vorname',
      'Nachname',
      'Strasse',
      'PLZ',
      'Ort',
      'Telefon',
      'E-Mail',
      'Notizen',
      'Zugeordnet zu (Typ)',
      'Zugeordnet zu (Name)',
      'Anzahl Spenden',
      'Spendensumme'
    ]

    // Build CSV rows
    const rows = sponsors.map(sponsor => {
      const assignedType = sponsor.memberId ? 'Mitglied' : sponsor.groupId ? 'Gruppe' : '-'
      const assignedName = sponsor.member
        ? `${sponsor.member.firstName} ${sponsor.member.lastName}`
        : sponsor.group
        ? sponsor.group.name
        : '-'

      const donationCount = sponsor.donations.length
      const donationSum = sponsor.donations.reduce((sum, d) => sum + (d.amount || 0), 0)

      return [
        sponsor.company,
        sponsor.salutation,
        sponsor.firstName,
        sponsor.lastName,
        sponsor.street,
        sponsor.postalCode,
        sponsor.city,
        sponsor.phone,
        sponsor.email,
        sponsor.notes,
        assignedType,
        assignedName,
        donationCount,
        donationSum.toFixed(2)
      ]
    })

    // Combine headers and rows
    const csvContent = buildCSV(headers, rows)

    // Generate filename with current date
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const filename = `Goenner_Export_${dateStr}.csv`

    // Return CSV with proper headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error exporting sponsors:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
